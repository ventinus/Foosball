const { randomUUID } = require("crypto");
const { createStore } = require("./store");
const { isConditionFailure, isRejected } = require("./errors");

const GAME_FIELDS = [
  "id",
  "sideAPoints",
  "sideBPoints",
  "startedAt",
  "endedAt",
  "switched",
];

const pickGame = (props) =>
  Object.fromEntries(
    GAME_FIELDS.filter((key) => props[key] !== undefined).map((key) => [
      key,
      props[key],
    ])
  );

const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const byStartedAtDesc = (a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "");

// Offline-first access to the API for the tracker. Reads try the API and fall
// back to local state; writes go into a persisted outbox that is sent in order,
// retrying with backoff until the table is back online.
exports.createSync = ({
  dataDir = null,
  api = require("../utils/api"),
  autoFlush = true,
  lookupTimeoutMs = 5000,
  retryBaseMs = 1000,
  retryMaxMs = 5 * 60000,
  maxRejections = 5,
  now = () => new Date().toISOString(),
  log = console.log,
} = {}) => {
  const store = createStore(dataDir, { log });
  const state = store.load();
  const persist = () => store.save(state);

  let flushing = false;
  let inFlight = null;
  let timer = null;
  let delay = retryBaseMs;
  let stopped = false;

  const scheduleRetry = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, delay);
    timer.unref?.();
    delay = Math.min(delay * 2, retryMaxMs);
  };

  // Forget a game's local copy once nothing about it is waiting to be sent;
  // from then on the API is the source of truth for it.
  const pruneGame = (gameId) => {
    if (gameId && !state.outbox.some((op) => op.gameId === gameId)) {
      delete state.games[gameId];
    }
  };

  // Sends queued changes in order. Stops at the first one that can't be sent
  // yet and retries later, so changes to a game never arrive out of order.
  const flush = async () => {
    if (flushing || stopped) return;
    flushing = true;
    clearTimeout(timer);
    timer = null;
    try {
      while (state.outbox.length && !stopped) {
        const op = state.outbox[0];
        inFlight = op;
        try {
          // op.type names the api function that sends it
          await api[op.type](op.input);
        } catch (err) {
          if (!isConditionFailure(err)) {
            if (!isRejected(err)) {
              log(`sync: ${op.type} not sent, retrying in ${delay}ms`, err);
              return scheduleRetry();
            }
            op.rejections = (op.rejections ?? 0) + 1;
            if (op.rejections < maxRejections) {
              log(`sync: ${op.type} rejected (${op.rejections})`, err);
              persist();
              return scheduleRetry();
            }
            log(`sync: ${op.type} rejected ${op.rejections} times, giving up`, err);
            state.failed.push({ ...op, error: err?.errors ?? String(err) });
          }
          // A condition failure means it's already applied (or can't be): move on.
        } finally {
          inFlight = null;
        }
        state.outbox.shift();
        pruneGame(op.gameId);
        persist();
        delay = retryBaseMs;
      }
    } finally {
      flushing = false;
    }
  };

  // Something just reached the API, so skip any backoff wait.
  const online = () => {
    if (autoFlush && state.outbox.length && timer) flush();
  };

  const enqueue = (op) => {
    const last = state.outbox.at(-1);
    // Each game update carries its full score, so a waiting one can absorb the next.
    const mergeable =
      op.type === "updateGame" &&
      last &&
      last !== inFlight &&
      last.type === "updateGame" &&
      last.gameId === op.gameId;
    if (mergeable) Object.assign(last.input, op.input);
    else state.outbox.push(op);
    persist();
    if (autoFlush && !timer) flush();
  };

  const cachePlayer = ({ id, alias }) => {
    if (state.players[id] === alias) return;
    state.players[id] = alias;
    persist();
  };

  // ---------------- Public ----------------- //

  // Resolves with { id, alias }, or null for a badge nobody has registered.
  const findPlayer = async (id) => {
    try {
      const player = await withTimeout(api.findPlayer(id), lookupTimeoutMs);
      online();
      if (player) {
        cachePlayer(player);
        return player;
      }
    } catch (err) {
      log("sync: findPlayer offline, using local players", err?.message ?? err);
    }
    // Also covers players registered here whose createPlayer hasn't been sent.
    const alias = state.players[id];
    return alias === undefined ? null : { id, alias };
  };

  const registerPlayer = ({ id, alias }) => {
    cachePlayer({ id, alias });
    enqueue({ type: "createPlayer", input: { fobId: id, alias, type: "Player" } });
    return { id, alias };
  };

  // Loads every registered player so badges are recognized while offline.
  const refreshPlayers = async () => {
    try {
      const players = await api.listPlayers();
      players.forEach(({ id, alias }) => (state.players[id] = alias));
      persist();
      online();
    } catch (err) {
      log("sync: couldn't refresh players", err?.message ?? err);
    }
  };

  // The id is made here so the game can start without the API; sending it with
  // a fixed id also makes a repeated create harmless.
  const createGame = ({ competitionId, playerIds, switched = false }) => {
    const game = {
      id: randomUUID(),
      competitionId,
      switched,
      sideAPoints: 0,
      sideBPoints: 0,
      startedAt: now(),
      type: "Game",
    };
    state.games[game.id] = { ...game };
    enqueue({ type: "createGame", gameId: game.id, input: game });
    playerIds.forEach((playerID) =>
      enqueue({
        type: "createPlayerGames",
        gameId: game.id,
        input: { id: `${game.id}::${playerID}`, gameID: game.id, playerID },
      })
    );
    return { ...game };
  };

  // Records a game's latest score/times locally and queues them to be sent.
  const saveGame = ({ competitionId, ...props }) => {
    const input = pickGame(props);
    state.games[input.id] = {
      ...state.games[input.id],
      ...input,
      ...(competitionId ? { competitionId } : {}),
    };
    enqueue({ type: "updateGame", gameId: input.id, input });
  };

  // The latest unfinished game for a matchup, from the API and local state.
  // Local copies win: they hold changes the API hasn't seen yet (e.g. the game
  // was finished here but that hasn't been sent).
  const findUnfinishedGame = async (competitionId) => {
    let remote = null;
    try {
      remote = await withTimeout(api.getCurrentGame(competitionId), lookupTimeoutMs);
      online();
    } catch (err) {
      log("sync: getCurrentGame offline, using local games", err?.message ?? err);
    }
    const candidates = Object.values(state.games).filter(
      (game) => game.competitionId === competitionId && !game.endedAt
    );
    if (remote && !state.games[remote.id]) candidates.push(remote);
    return candidates.sort(byStartedAtDesc)[0] ?? null;
  };

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    timer = null;
  };

  if (autoFlush && state.outbox.length) flush();

  return {
    findPlayer,
    registerPlayer,
    refreshPlayers,
    createGame,
    saveGame,
    findUnfinishedGame,
    flush,
    stop,
    pending: () => structuredClone(state.outbox),
    failed: () => structuredClone(state.failed),
  };
};
