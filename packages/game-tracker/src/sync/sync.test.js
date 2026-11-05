const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSync } = require("./sync");

// AppSync's error shapes, as Amplify rejects with them.
const networkError = () => ({ data: {}, errors: [{ message: "Network error" }] });
const rejected = (errorType = "MappingTemplate") => ({
  data: null,
  errors: [{ message: "nope", errorType }],
});

const fakeApi = () => ({
  findPlayer: jest.fn(async () => null),
  listPlayers: jest.fn(async () => []),
  getCurrentGame: jest.fn(async () => null),
  createPlayer: jest.fn(async () => ({})),
  createGame: jest.fn(async () => ({})),
  createPlayerGames: jest.fn(async () => ({})),
  updateGame: jest.fn(async () => ({})),
});

const goOffline = (api) =>
  Object.values(api).forEach((fn) =>
    fn.mockImplementation(() => Promise.reject(networkError()))
  );

// Resolves once `check` passes, polling across timers and promises.
const eventually = async (check, ms = 1000) => {
  const until = Date.now() + ms;
  for (;;) {
    try {
      return check();
    } catch (err) {
      if (Date.now() > until) throw err;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
};

let dataDir;
let api;
let syncs = [];
const make = (options = {}) => {
  const sync = createSync({
    api,
    dataDir,
    autoFlush: false,
    retryBaseMs: 5,
    retryMaxMs: 20,
    lookupTimeoutMs: 50,
    log: () => {},
    ...options,
  });
  syncs.push(sync);
  return sync;
};

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracker-sync-"));
  api = fakeApi();
});

afterEach(() => {
  syncs.forEach((sync) => sync.stop());
  syncs = [];
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const startGame = (sync) =>
  sync.createGame({ competitionId: "1V2", playerIds: ["1", "2"] });

describe("sync", () => {
  describe("players", () => {
    it("remembers players found online for offline lookups", async () => {
      const sync = make();
      api.findPlayer.mockResolvedValueOnce({ id: "1", alias: "ann" });
      await sync.findPlayer("1");

      goOffline(api);
      await expect(sync.findPlayer("1")).resolves.toEqual({ id: "1", alias: "ann" });
      await expect(sync.findPlayer("2")).resolves.toBe(null);
    });

    it("falls back to local players when a lookup hangs", async () => {
      const sync = make();
      sync.registerPlayer({ id: "1", alias: "ann" });
      api.findPlayer.mockReturnValue(new Promise(() => {}));

      await expect(sync.findPlayer("1")).resolves.toEqual({ id: "1", alias: "ann" });
    });

    it("finds players registered here before they reach the API", async () => {
      const sync = make();
      sync.registerPlayer({ id: "9", alias: "new" });

      await expect(sync.findPlayer("9")).resolves.toEqual({ id: "9", alias: "new" });
      expect(sync.pending()).toEqual([
        {
          type: "createPlayer",
          input: { fobId: "9", alias: "new", type: "Player" },
        },
      ]);
    });

    it("loads every player for offline use", async () => {
      api.listPlayers.mockResolvedValue([{ id: "5", alias: "eve" }]);
      await make().refreshPlayers();

      goOffline(api);
      await expect(make().findPlayer("5")).resolves.toEqual({ id: "5", alias: "eve" });
    });
  });

  describe("outbox", () => {
    it("sends queued changes in order and forgets sent games", async () => {
      const sync = make();
      const game = startGame(sync);
      sync.saveGame({ ...game, sideAPoints: 1 });
      sync.saveGame({ ...game, sideAPoints: 2, endedAt: "2026-11-01T00:00:00Z" });

      expect(sync.pending().map((op) => op.type)).toEqual([
        "createGame",
        "createPlayerGames",
        "createPlayerGames",
        "updateGame", // the two saves were merged
      ]);

      await sync.flush();

      expect(api.createGame).toHaveBeenCalledWith(
        expect.objectContaining({ id: game.id, competitionId: "1V2" })
      );
      expect(api.createPlayerGames.mock.calls.map(([input]) => input)).toEqual([
        { id: `${game.id}::1`, gameID: game.id, playerID: "1" },
        { id: `${game.id}::2`, gameID: game.id, playerID: "2" },
      ]);
      expect(api.updateGame).toHaveBeenCalledTimes(1);
      expect(api.updateGame).toHaveBeenCalledWith(
        expect.objectContaining({ sideAPoints: 2, endedAt: "2026-11-01T00:00:00Z" })
      );
      expect(sync.pending()).toEqual([]);
      // the API is the source of truth once everything is sent
      await expect(sync.findUnfinishedGame("1V2")).resolves.toBe(null);
    });

    it("keeps the queue across restarts", async () => {
      startGame(make());

      const restarted = make();
      expect(restarted.pending()).toHaveLength(3);
      await restarted.flush();
      expect(api.createGame).toHaveBeenCalledTimes(1);
      expect(make().pending()).toEqual([]);
    });

    it("stops at the first unsent change and retries until back online", async () => {
      goOffline(api);
      const sync = make({ autoFlush: true });
      startGame(sync);

      await eventually(() => expect(api.createGame.mock.calls.length).toBeGreaterThan(1));
      expect(api.createPlayerGames).not.toHaveBeenCalled();

      api.createGame.mockResolvedValue({});
      api.createPlayerGames.mockResolvedValue({});
      await eventually(() => expect(sync.pending()).toEqual([]));
      expect(api.createPlayerGames).toHaveBeenCalledTimes(2);
    });

    it("treats an already-applied create as sent", async () => {
      api.createPlayer.mockRejectedValue(
        rejected("DynamoDB:ConditionalCheckFailedException")
      );
      const sync = make();
      sync.registerPlayer({ id: "1", alias: "ann" });

      await sync.flush();
      expect(sync.pending()).toEqual([]);
      expect(sync.failed()).toEqual([]);
    });

    it("sets aside a change the API keeps rejecting and moves on", async () => {
      api.createPlayer.mockRejectedValue(rejected());
      const sync = make({ autoFlush: true, maxRejections: 2 });
      sync.registerPlayer({ id: "1", alias: "ann" });
      sync.registerPlayer({ id: "2", alias: "bob" });

      await eventually(() => expect(sync.pending()).toEqual([]));
      expect(api.createPlayer).toHaveBeenCalledTimes(4);
      expect(sync.failed().map((op) => op.input.fobId)).toEqual(["1", "2"]);
    });

    it("doesn't merge a save into one that's being sent", async () => {
      let finish;
      api.updateGame.mockImplementationOnce(
        () => new Promise((resolve) => (finish = resolve))
      );
      const sync = make();
      sync.saveGame({ id: "g", sideAPoints: 1 });
      const sending = sync.flush();
      sync.saveGame({ id: "g", sideAPoints: 2 });
      finish();
      await sending;

      expect(api.updateGame.mock.calls.map(([input]) => input.sideAPoints)).toEqual([
        1, 2,
      ]);
    });

    it("sets aside an unreadable state file and starts fresh", () => {
      fs.writeFileSync(path.join(dataDir, "sync.json"), "{not json");

      expect(make().pending()).toEqual([]);
      expect(
        fs.readdirSync(dataDir).some((f) => f.startsWith("sync.json.corrupt-"))
      ).toBe(true);
    });
  });

  describe("status", () => {
    it("should start unknown with nothing waiting", () => {
      expect(make().status()).toEqual({ online: null, pending: 0, failed: 0 });
    });

    it("should count writes waiting to be sent", () => {
      const sync = make();
      sync.registerPlayer({ id: "1", alias: "a" });
      expect(sync.status()).toMatchObject({ pending: 1 });
    });

    it("should report going offline and back online", async () => {
      const sync = make();
      const seen = [];
      sync.onStatus((status) => seen.push(status));

      goOffline(api);
      await sync.findPlayer("1");
      expect(sync.status().online).toBe(false);

      api.findPlayer.mockResolvedValue(null);
      await sync.findPlayer("1");
      expect(sync.status().online).toBe(true);
      expect(seen.map((status) => status.online)).toEqual([false, true]);
    });

    it("should report sends and failures", async () => {
      const sync = make({ maxRejections: 1 });
      sync.registerPlayer({ id: "1", alias: "a" });
      api.createPlayer.mockRejectedValue(rejected());
      await sync.flush();
      expect(sync.status()).toEqual({ online: true, pending: 0, failed: 1 });

      sync.registerPlayer({ id: "2", alias: "b" });
      api.createPlayer.mockResolvedValue({});
      await sync.flush();
      expect(sync.status()).toEqual({ online: true, pending: 0, failed: 1 });
    });

    it("should stop telling a listener once unsubscribed", () => {
      const sync = make();
      const listener = jest.fn();
      const unsubscribe = sync.onStatus(listener);
      unsubscribe();
      sync.registerPlayer({ id: "1", alias: "a" });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("findUnfinishedGame", () => {
    it("finds a game started here while offline", async () => {
      goOffline(api);
      const sync = make();
      const game = startGame(sync);

      await expect(sync.findUnfinishedGame("1V2")).resolves.toMatchObject({
        id: game.id,
      });
      await expect(sync.findUnfinishedGame("1V3")).resolves.toBe(null);
    });

    it("ignores an unfinished API game that was finished here", async () => {
      api.getCurrentGame.mockResolvedValue({ id: "g", startedAt: "2026-01-01" });
      const sync = make();
      sync.saveGame({ id: "g", competitionId: "1V2", endedAt: "2026-01-02" });

      await expect(sync.findUnfinishedGame("1V2")).resolves.toBe(null);
    });

    it("prefers the newest of the API's and the local games", async () => {
      api.getCurrentGame.mockResolvedValue({ id: "old", startedAt: "2020-01-01" });
      const sync = make();
      const game = startGame(sync);

      await expect(sync.findUnfinishedGame("1V2")).resolves.toMatchObject({
        id: game.id,
      });
    });
  });
});
