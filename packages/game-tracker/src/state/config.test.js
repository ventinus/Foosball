const { createActor, waitFor } = require("xstate");

const api = require("../utils/api");
const helpers = require("../utils/helpers");
const Game = require("../models/game");

const {
  INITIATE_GAME,
  BADGE_SCAN,
  ADD_PLAYER,
  SCORE_POINT,
  APPEND_CHAR,
  BACKSPACE,
  CONFIRM,
  DENY,
  WARN_PAUSE,
  GAME_ACTIVITY,
  PAUSE,
  MOVE_PLAYER,
  REMOVE_PLAYER,
  SWAP_SIDES,
  UNDO_GOAL,
  ABANDON,
  SET_ALIAS,
  REMATCH,
} = require("./actionTypes");
const lineup = require("./lineup");

const {
  gameMachine,
  initialContext,
  REGISTRATION_TIMEOUT_MS,
  UNDO_WINDOW_MS,
  REMATCH_WINDOW_MS,
} = require("./config");

jest.mock("../utils/helpers", () => ({
  ...jest.requireActual("../utils/helpers"),
  prompt: jest.fn(),
  beep: jest.fn(),
  showCompetition: jest.fn(),
}));


const sync = require("../sync");

// Writes the sync layer has queued for the API, by type.
const queued = (type) =>
  sync
    .pending()
    .filter((op) => op.type === type)
    .map((op) => op.input);

const UNKNOWN = "UNKNOWN";

let actor;

// Tests may seed `players` (ids or player objects) in scan order; they're
// seated the way scans fill the table: side A, side B, side A, side B.
const seat = ({ players, ...context }) =>
  players
    ? {
        ...context,
        sides: players
          .map((p) => (typeof p === "object" ? p : { id: p }))
          .reduce(lineup.seatPlayer, lineup.emptySides()),
      }
    : context;

// The seated players, side A then side B.
const seated = () => lineup.playersOf(state().context.sides);

// Start a fresh actor in the initial state, seeding part of the context.
const start = (context = {}) =>
  (actor = createActor(gameMachine, { input: seat(context) }).start());

// Start an actor directly in `value` (entry actions for that state do not run).
const startAt = (value, context = {}) => {
  const snapshot = gameMachine.resolveState({
    value,
    context: { ...initialContext, ...seat(context) },
  });
  return (actor = createActor(gameMachine, { snapshot }).start());
};

const send = (type, payload = {}) => actor.send({ type, ...payload });
const state = () => actor.getSnapshot();
const reach = (value) => waitFor(actor, (s) => s.matches(value));

// The API is unreachable: lookups fall back to local data.
const offline = () => {
  jest.spyOn(console, "log").mockImplementation(() => null);
  const down = () => Promise.reject(new Error("network down"));
  jest.spyOn(api, "findPlayer").mockImplementation(down);
  jest.spyOn(api, "getCurrentGame").mockImplementation(down);
};

describe("gameMachine", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    // Fresh memory-only state that queues writes but never sends them, so no
    // request outlives its test (reads still go to MSW).
    sync.init({ autoFlush: false });
  });

  afterEach(() => {
    actor?.stop();
  });

  it("should initialize with the correct config", () => {
    start();
    expect(state().value).toEqual("inactive");

    expect(state().context).toEqual({
      sides: [
        [null, null],
        [null, null],
      ],
      currentGame: null,
      bestOfLimit: 1,
      deadline: null,
      newPlayer: {
        id: 0,
        alias: "",
      },
    });
  });

  describe("inactive", () => {
    it("should not change state from an unknown action", () => {
      start();
      const before = state();
      send(UNKNOWN);
      expect(state().value).toBe("inactive");
      expect(state().context).toEqual(before.context);
    });

    it("should NOT initiate the game with no players", () => {
      start();
      send(INITIATE_GAME);
      expect(state().value).toBe("inactive");
    });

    it("should initiate registration when unrecognized badge is scanned", async () => {
      start();
      send(BADGE_SCAN, { id: 123 });
      await reach("registration");

      expect(state().context.newPlayer.id).toBe("123");
      expect(helpers.prompt.mock.calls[0][0]).toBe(
        "Please wait while I look you up..."
      );
      expect(helpers.prompt.mock.calls[1][0]).toEqual([
        "Enter a name (max 10, Esc to cancel):",
        "",
        "",
      ]);
    });

    it("should add a player when badge is recognized", async () => {
      start();
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(
        actor,
        (s) => s.matches("inactive") && lineup.playersOf(s.context.sides).length > 0
      );

      expect(seated()).toEqual([
        { id: "12345", alias: "player-exists" },
      ]);
    });

    it("should add players to the end of the list", async () => {
      start({ players: [{ id: "1234", alias: "bar" }] });
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(
        actor,
        (s) => s.matches("inactive") && lineup.playersOf(s.context.sides).length === 2
      );

      expect(seated()).toEqual([
        { id: "1234", alias: "bar" },
        { id: "12345", alias: "player-exists" },
      ]);
      expect(state().context.currentGame).toBe(null);
    });

    it("should NOT add a player twice", () => {
      start({ players: [{ id: "12345" }] });
      send(BADGE_SCAN, { id: "12345" });

      expect(state().value).toBe("inactive");
      expect(seated()).toEqual([{ id: "12345" }]);
      expect(state().context.currentGame).toBe(null);
    });

    it("should NOT add a player twice when the reader sends a numeric id", () => {
      // the API returns fobId as a string; the RFID reader sends a number
      start({ players: [{ id: "12345", alias: "player-exists" }] });
      send(BADGE_SCAN, { id: 12345 });

      expect(state().value).toBe("inactive");
      expect(seated()).toHaveLength(1);
    });

    it("should reject a new badge when the table is full", () => {
      start({ players: [1, 2, 3, 4] });
      const before = state().context.sides;
      send(BADGE_SCAN, { id: "12345" });

      expect(state().value).toBe("inactive");
      expect(state().context.sides).toBe(before);
      expect(helpers.beep).toHaveBeenCalled();
    });

    it("should ignore a seated player rescanning at a full table", () => {
      start({ players: [1, 2, 3, 4] });
      send(BADGE_SCAN, { id: 3 });

      expect(state().value).toBe("inactive");
      expect(helpers.beep).not.toHaveBeenCalled();
    });

    it("should seat players side A, side B, side A, side B", () => {
      start({ players: [1, 2, 3] });
      expect(state().context.sides).toEqual([
        [{ id: 1 }, { id: 3 }],
        [{ id: 2 }, null],
      ]);
    });

    it("should move a player to another slot", () => {
      start({ players: [1, 2, 3] });
      send(MOVE_PLAYER, { id: 3, side: 1, slot: 1 });
      expect(state().context.sides).toEqual([
        [{ id: 1 }, null],
        [{ id: 2 }, { id: 3 }],
      ]);
    });

    it("should remove a player", () => {
      start({ players: [1, 2] });
      send(REMOVE_PLAYER, { id: 2 });
      expect(seated()).toEqual([{ id: 1 }]);
      send(INITIATE_GAME);
      expect(state().value).toBe("inactive");
    });

    it("should swap sides", () => {
      start({ players: [1, 2] });
      send(SWAP_SIDES);
      expect(state().context.sides).toEqual([
        [{ id: 2 }, null],
        [{ id: 1 }, null],
      ]);
    });

    it("should not start with every player on one side", () => {
      start({ players: [1, 2] });
      send(MOVE_PLAYER, { id: 2, side: 0, slot: 1 });
      send(INITIATE_GAME);
      expect(state().value).toBe("inactive");
    });

    it("should form teams from the sides, not the scan order", async () => {
      start({ players: [5, 6, 7, 8] });
      // 5 and 6 scanned first but play together on side B
      send(MOVE_PLAYER, { id: 5, side: 1, slot: 1 });
      send(MOVE_PLAYER, { id: 7, side: 0, slot: 1 });
      expect(lineup.teamsOf(state().context.sides)).toEqual(["7::8", "5::6"]);
      send(INITIATE_GAME);
      await reach("active");

      const game = state().context.currentGame;
      expect(game.competitionId).toBe("5::6V7::8");
      expect(game.props).toMatchObject({ t1: "7::8", t2: "5::6" });
    });

    it("should initiate the game", async () => {
      start({ players: [{ id: 1 }, { id: 2 }] });
      send(INITIATE_GAME);
      expect(state().value).toBe("pending");
      await reach("active");
    });

    it("should initiate a 2v1 game", async () => {
      start({ players: [{ id: 1 }, { id: 2 }, { id: 3 }] });
      send(INITIATE_GAME);
      expect(state().value).toBe("pending");
      await reach("active");
      expect(state().context.currentGame.competitionId).toBe("1::3V2");
    });

    it("should not initiate the game with one player", () => {
      start({ players: [{ id: 1 }] });
      send(INITIATE_GAME);
      expect(state().value).toBe("inactive");
    });
  });

  describe("registration", () => {
    it("should handle inputting an alias", () => {
      startAt("registration", { newPlayer: { id: "888", alias: "" } });

      send(APPEND_CHAR, { character: "a" });
      send(APPEND_CHAR, { character: "b" });
      send(APPEND_CHAR, { character: "e" });
      expect(helpers.prompt.mock.calls[0][0][0]).toBe("Enter a name (max 10, Esc to cancel):");
      expect(state().context.newPlayer.alias).toBe("abe");

      send(BACKSPACE);
      expect(helpers.prompt).toHaveBeenCalledTimes(4);
      expect(helpers.prompt.mock.calls.map((call) => call[0][2])).toEqual([
        "a",
        "ab",
        "abe",
        "ab",
      ]);

      send(CONFIRM);
      expect(queued("createPlayer")).toEqual([
        { fobId: "888", alias: "ab", type: "Player" },
      ]);
      expect(state().context.newPlayer).toEqual({ id: "0", alias: "" });
      expect(seated()).toEqual([{ id: "888", alias: "ab" }]);
      expect(state().value).toBe("inactive");
    });

    it("should not confirm an empty alias", () => {
      startAt("registration", { newPlayer: { id: "888", alias: "" } });

      send(CONFIRM);
      expect(state().value).toBe("registration");
      expect(queued("createPlayer")).toEqual([]);
    });

    it("should cancel back to inactive without creating a player", () => {
      startAt("registration", {
        players: [{ id: "1", alias: "one" }],
        newPlayer: { id: "888", alias: "ab" },
      });

      send(DENY);
      expect(state().value).toBe("inactive");
      expect(state().context.newPlayer).toEqual({ id: "0", alias: "" });
      expect(seated()).toEqual([{ id: "1", alias: "one" }]);
      expect(queued("createPlayer")).toEqual([]);
    });

    it("should return to inactive when nobody types", async () => {
      const machine = gameMachine.provide({
        delays: { registrationTimeout: 50 },
      });
      actor = createActor(machine).start();
      send(BADGE_SCAN, { id: 123 });
      await reach("registration");

      await reach("inactive");
      expect(state().context.newPlayer).toEqual({ id: "0", alias: "" });
      expect(seated()).toEqual([]);
      expect(queued("createPlayer")).toEqual([]);
    });

    it("should take the whole alias from the iPad", () => {
      startAt("registration", { newPlayer: { id: "888", alias: "" } });
      send(SET_ALIAS, { alias: "Jo Gray!" });
      expect(state().context.newPlayer.alias).toBe("JoGray");

      send(SET_ALIAS, { alias: "abcdefghijklmnop" });
      expect(state().context.newPlayer.alias).toBe("abcdefghij");

      send(SET_ALIAS, { alias: "" });
      send(CONFIRM);
      expect(state().value).toBe("registration");
    });

    describe("timeout", () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it("should restart the timeout on each keystroke", () => {
        startAt("registration", { newPlayer: { id: "888", alias: "" } });
        send(APPEND_CHAR, { character: "a" });

        jest.advanceTimersByTime(REGISTRATION_TIMEOUT_MS - 1000);
        send(APPEND_CHAR, { character: "b" });
        jest.advanceTimersByTime(REGISTRATION_TIMEOUT_MS - 1000);
        expect(state().value).toBe("registration");
        expect(state().context.newPlayer.alias).toBe("ab");

        jest.advanceTimersByTime(1000);
        expect(state().value).toBe("inactive");
      });

      it("should restart the timeout when the iPad sends the alias", () => {
        startAt("registration", { newPlayer: { id: "888", alias: "" } });
        jest.advanceTimersByTime(REGISTRATION_TIMEOUT_MS - 1000);
        send(SET_ALIAS, { alias: "jo" });
        expect(state().context.deadline).toBe(
          Date.now() + REGISTRATION_TIMEOUT_MS
        );
        jest.advanceTimersByTime(REGISTRATION_TIMEOUT_MS - 1000);
        expect(state().value).toBe("registration");
      });
    });
  });

  describe("fire-and-forget saves", () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    it("should log, not reject, when creating a player fails", async () => {
      const log = jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(sync, "registerPlayer").mockImplementationOnce(() => {
        throw new Error("disk full");
      });
      startAt("registration", { newPlayer: { id: "888", alias: "ab" } });

      send(CONFIRM);
      await flush();

      expect(state().value).toBe("inactive");
      expect(log).toHaveBeenCalledWith("createPlayer failed", expect.any(Error));
      log.mockRestore();
    });

    it("should log, not reject, when saving a point fails", async () => {
      const log = jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(sync, "saveGame").mockImplementationOnce(() => {
        throw new Error("disk full");
      });
      startAt("active", {
        players: [{ id: "1" }, { id: "2" }],
        currentGame: Game("1", "2", { sideAPoints: 0, sideBPoints: 0 }),
      });

      send(SCORE_POINT, { index: 0 });
      await flush();

      expect(state().context.currentGame.teamPoints).toEqual([1, 0]);
      expect(log).toHaveBeenCalledWith("updateGame failed", expect.any(Error));
      log.mockRestore();
    });
  });

  describe("pending", () => {
    it("should automatically start a new game when no unfinished game is found", async () => {
      start({ players: [{ id: 1 }, { id: 2 }] });
      send(INITIATE_GAME);
      await reach("active");

      expect(state().context.currentGame.teamPoints).toEqual([0, 0]);
      expect(state().context.currentGame.competitionId).toEqual("1V2");
    });

    it("should move to shouldResume state when an unfinished game is found", async () => {
      // seats 1::2 on side A and 3::4 on side B
      start({ players: [1, 3, 2, 4] });
      send(INITIATE_GAME);
      await reach("shouldResume");

      expect(state().context.currentGame.teamPoints).toEqual([4, 3]);
      expect(helpers.prompt.mock.calls[0][0]).toBe(
        "Would you like to resume your previous unfinished game?"
      );
    });

    it("should not resume a game that was finished here but not sent yet", async () => {
      sync.saveGame({
        id: "game-id",
        competitionId: "1::2V3::4",
        sideAPoints: 5,
        sideBPoints: 3,
        endedAt: new Date().toISOString(),
      });
      start({ players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
      send(INITIATE_GAME);
      await reach("active");

      expect(state().context.currentGame.teamPoints).toEqual([0, 0]);
      expect(state().context.currentGame.props.id).not.toBe("game-id");
    });
  });

  describe("shouldResume", () => {
    it("should resume the game", () => {
      startAt("shouldResume", {
        players: [1, 2],
        currentGame: Game("1", "2", { sideAPoints: 1, sideBPoints: 3 }),
      });

      send(CONFIRM);
      expect(state().value).toBe("active");
      expect(state().context.currentGame.teamPoints).toEqual([1, 3]);
    });

    it("should reset the current game score and startedAt", () => {
      startAt("shouldResume", {
        players: [1, 2],
        currentGame: Game("1", "2", { sideAPoints: 1, sideBPoints: 3 }),
      });

      send(DENY);
      expect(queued("updateGame")).toContainEqual(
        expect.objectContaining({
          sideAPoints: 0,
          sideBPoints: 0,
          startedAt: expect.any(String),
        })
      );
      expect(state().context.currentGame.teamPoints).toEqual([0, 0]);
      expect(state().value).toBe("active");
      // only the exit prompt clears the screen; entry already ran before startAt
      expect(helpers.prompt).toHaveBeenCalledTimes(1);
    });
  });

  describe("active", () => {
    const defaultGameProps = {
      sideAPoints: 0,
      sideBPoints: 0,
    };

    it("should not change state from an unknown action", () => {
      startAt("active", {
        players: [1, 2],
        currentGame: Game("1", "2", defaultGameProps),
      });

      send(ADD_PLAYER);
      expect(state().value).toBe("active");
      expect(state().context.currentGame.teamPoints).toEqual([0, 0]);

      send(UNKNOWN);
      expect(state().value).toBe("active");
    });

    it("should make updates on SCORE_POINT", () => {
      startAt("active", {
        players: [1, 2],
        currentGame: Game("1", "2", defaultGameProps),
      });

      send(SCORE_POINT, { index: 0 });
      expect(state().context.currentGame.teamPoints).toEqual([1, 0]);

      send(SCORE_POINT, { index: 1 });
      expect(state().context.currentGame.teamPoints).toEqual([1, 1]);

      // the two saves are merged while waiting to be sent
      expect(queued("updateGame")).toEqual([
        expect.objectContaining({ sideAPoints: 1, sideBPoints: 1 }),
      ]);
    });

    it("should undo the latest goal", () => {
      startAt("active", {
        players: [1, 2],
        currentGame: Game("1", "2", defaultGameProps),
      });
      send(SCORE_POINT, { index: 0 });
      send(SCORE_POINT, { index: 1 });

      send(UNDO_GOAL);
      expect(state().context.currentGame.teamPoints).toEqual([1, 0]);
      expect(queued("updateGame")).toEqual([
        expect.objectContaining({ sideAPoints: 1, sideBPoints: 0 }),
      ]);
    });

    it("should ignore undo with no goals to take back", () => {
      startAt("active", {
        players: [1, 2],
        currentGame: Game("1", "2", { sideAPoints: 2, sideBPoints: 1 }),
      });
      send(UNDO_GOAL);
      expect(state().context.currentGame.teamPoints).toEqual([2, 1]);
      expect(queued("updateGame")).toEqual([]);
    });

    it("should abandon the game, leaving it unfinished", () => {
      const currentGame = Game("1", "2", defaultGameProps);
      startAt("active", { players: [1, 2], currentGame });
      send(SCORE_POINT, { index: 0 });

      send(ABANDON);
      expect(state().value).toBe("inactive");
      expect(seated()).toEqual([]);
      expect(currentGame.completed).toBe(false);
    });
  });

  describe("complete", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    // A game one goal from the end, with side B about to win 5-4.
    const finish = () => {
      const currentGame = Game("1", "2", {
        id: "game-id",
        sideAPoints: 4,
        sideBPoints: 4,
      });
      startAt("active", { players: [1, 2], currentGame });
      send(SCORE_POINT, { index: 1 });
      return currentGame;
    };

    it("should show the final score without saving it yet", () => {
      const currentGame = finish();

      expect(state().matches({ complete: "confirming" })).toBe(true);
      expect(currentGame.teamPoints).toEqual([4, 5]);
      expect(currentGame.completed).toBe(false);
      expect(state().context.deadline).toBe(Date.now() + UNDO_WINDOW_MS);
    });

    it("should undo the winning goal and play on", () => {
      const currentGame = finish();
      send(UNDO_GOAL);

      expect(state().value).toBe("active");
      expect(currentGame.teamPoints).toEqual([4, 4]);

      jest.advanceTimersByTime(UNDO_WINDOW_MS);
      expect(currentGame.completed).toBe(false);
    });

    it("should save the game as finished when the undo window ends", async () => {
      const currentGame = finish();
      await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(state().matches({ complete: "saved" })).toBe(true);
      expect(currentGame.completed).toBe(true);
      expect(queued("updateGame")).toContainEqual(
        expect.objectContaining({ id: "game-id", endedAt: expect.any(String) })
      );

      // too late to undo
      send(UNDO_GOAL);
      expect(state().matches({ complete: "saved" })).toBe(true);
    });

    it("should clear the table when the rematch window ends", async () => {
      finish();
      await jest.advanceTimersByTimeAsync(REMATCH_WINDOW_MS - 1);
      expect(state().matches("complete")).toBe(true);

      await jest.advanceTimersByTimeAsync(1);
      expect(state().value).toBe("inactive");
      expect(seated()).toEqual([]);
      expect(state().context.currentGame).toBe(null);
    });

    it("should still clear the table when saving the game fails", async () => {
      const log = jest.spyOn(console, "log").mockImplementation(() => null);
      const currentGame = Game("1", "2", { sideAPoints: 4, sideBPoints: 4 });
      jest
        .spyOn(currentGame, "endGame")
        .mockRejectedValueOnce(new Error("disk full"));
      startAt("active", { players: [1, 2], currentGame });
      send(SCORE_POINT, { index: 1 });

      await jest.advanceTimersByTimeAsync(REMATCH_WINDOW_MS);
      expect(state().value).toBe("inactive");
      expect(log).toHaveBeenCalledWith("completeGame failed", expect.any(Error));
      log.mockRestore();
    });

    it("should start the next lineup when a badge is scanned", async () => {
      finish();
      await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      send(BADGE_SCAN, { id: "12345" });
      await jest.advanceTimersByTimeAsync(0);
      await waitFor(actor, () => seated().length === 1);

      expect(seated()).toEqual([{ id: "12345", alias: "player-exists" }]);
      expect(state().context.currentGame).toBe(null);
    });
  });

  describe("rematch", () => {
    beforeEach(() => offline());

    const playToFive = async () => {
      start({ players: ["1", "2"] });
      send(INITIATE_GAME);
      await reach("active");
      const first = state().context.currentGame;
      for (let i = 0; i < 5; i++) send(SCORE_POINT, { index: 0 });
      expect(state().matches("complete")).toBe(true);
      return first;
    };

    it("should save the finished game and start another with the same lineup", async () => {
      const first = await playToFive();
      send(REMATCH);
      await reach("active");

      const second = state().context.currentGame;
      expect(first.completed).toBe(true);
      expect(second.props.id).not.toBe(first.props.id);
      expect(second.competitionId).toBe("1V2");
      expect(second.teamPoints).toEqual([0, 0]);
      expect(lineup.teamsOf(state().context.sides)).toEqual(["1", "2"]);
      expect(queued("createGame").map((g) => g.id)).toEqual([
        first.props.id,
        second.props.id,
      ]);
    });

    it("should let the rematch be played on the other ends", async () => {
      await playToFive();
      send(REMATCH);
      await reach("active");
      send(SWAP_SIDES);

      expect(state().context.currentGame.props).toMatchObject({ t1: "2", t2: "1" });
    });

    it("should not save a game twice when rematched after the undo window", async () => {
      jest.useFakeTimers();
      const first = await playToFive();
      await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      expect(state().matches({ complete: "saved" })).toBe(true);
      const endGame = jest.spyOn(first, "endGame");

      send(REMATCH);
      await reach("active");
      expect(endGame).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe("pauseWarning", () => {
    const gameProps = (extra = {}) => ({
      players: [1, 2],
      currentGame: Game("1", "2", { ...extra, sideAPoints: 4, sideBPoints: 4 }),
    });

    it("should turn on the warning on entry", () => {
      startAt("active", gameProps());

      send(WARN_PAUSE);
      expect(state().value).toBe("pauseWarning");
      expect(helpers.beep).toHaveBeenCalled();
      expect(helpers.prompt).toHaveBeenCalledWith(
        "Are you still playing this game?"
      );
    });

    it("should go back to active on confirm", () => {
      startAt("pauseWarning", gameProps());

      send(CONFIRM);
      expect(state().value).toBe("active");
    });

    it("should go back to active when activity detected", () => {
      startAt("pauseWarning", gameProps());

      send(GAME_ACTIVITY);
      expect(state().value).toBe("active");
    });

    it("should hold the deadline sent with the warning", () => {
      startAt("active", gameProps());
      send(WARN_PAUSE, { endsAt: 1234 });
      expect(state().context.deadline).toBe(1234);
    });

    it("should abandon the game", () => {
      startAt("pauseWarning", gameProps());
      send(ABANDON);
      expect(state().value).toBe("inactive");
      expect(state().context.currentGame).toBe(null);
    });

    it("should pause and reset the game when denied", () => {
      startAt("pauseWarning", gameProps());

      send(PAUSE);
      expect(state().value).toBe("inactive");
      expect(state().context.currentGame).toBe(null);
      expect(seated()).toEqual([]);
    });
  });

  describe("offline", () => {

    it("should recognize a player seen before while offline", async () => {
      start();
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(actor, (s) => lineup.playersOf(s.context.sides).length === 1);

      offline();
      actor.stop();
      start();
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(actor, (s) => lineup.playersOf(s.context.sides).length === 1);

      expect(seated()).toEqual([
        { id: "12345", alias: "player-exists" },
      ]);
    });

    it("should register an unknown badge while offline", async () => {
      offline();
      start();
      send(BADGE_SCAN, { id: "777" });
      await reach("registration");
      send(APPEND_CHAR, { character: "z" });
      send(CONFIRM);

      expect(seated()).toEqual([{ id: "777", alias: "z" }]);
      expect(queued("createPlayer")).toEqual([
        { fobId: "777", alias: "z", type: "Player" },
      ]);
    });

    it("should play a whole game offline and queue it to be sent", async () => {
      offline();
      start({ players: [{ id: "1" }, { id: "2" }, { id: "3" }] });
      send(INITIATE_GAME);
      await reach("active");
      const { id } = state().context.currentGame.props;

      jest.useFakeTimers();
      for (let i = 0; i < 5; i++) send(SCORE_POINT, { index: 1 });
      await jest.advanceTimersByTimeAsync(REMATCH_WINDOW_MS);
      jest.useRealTimers();
      expect(state().value).toBe("inactive");

      expect(queued("createGame")).toEqual([
        expect.objectContaining({ id, competitionId: "1::3V2", type: "Game" }),
      ]);
      expect(queued("createPlayerGames").map((pg) => pg.playerID)).toEqual([
        "1",
        "3",
        "2",
      ]);
      expect(queued("updateGame")).toEqual([
        expect.objectContaining({
          id,
          sideAPoints: 0,
          sideBPoints: 5,
          endedAt: expect.any(String),
        }),
      ]);
    });

    it("should record that side A's team sorts second in the competition", async () => {
      offline();
      // 3 and 4 play side A (goal sensor 0)
      start({ players: ["3", "1", "4", "2"] });
      send(INITIATE_GAME);
      await reach("active");

      expect(queued("createGame")).toEqual([
        expect.objectContaining({ competitionId: "1::2V3::4", switched: true }),
      ]);
    });

    it("should not mark a game switched when side A's team sorts first", async () => {
      offline();
      start({ players: [{ id: "1" }, { id: "2" }] });
      send(INITIATE_GAME);
      await reach("active");

      expect(queued("createGame")).toEqual([
        expect.objectContaining({ competitionId: "1V2", switched: false }),
      ]);
    });

    it("should resume a game on the ends it was played on", async () => {
      offline();
      // 3 plays side A and scores
      start({ players: [{ id: "3" }, { id: "1" }] });
      send(INITIATE_GAME);
      await reach("active");
      send(SCORE_POINT, { index: 0 });
      send(WARN_PAUSE);
      send(PAUSE);
      await reach("inactive");

      // lined up on the other ends this time
      actor.stop();
      start({ players: [{ id: "1" }, { id: "3" }] });
      send(INITIATE_GAME);
      await reach("shouldResume");

      const game = state().context.currentGame;
      expect(game.props).toMatchObject({ t1: "3", t2: "1" });
      expect(game.teamPoints).toEqual([1, 0]);
      // the lineup moves back to the ends the game was played on
      expect(lineup.teamsOf(state().context.sides)).toEqual(["3", "1"]);
    });

    it("should let teams switch ends before the first goal", async () => {
      offline();
      start({ players: ["1", "2"] });
      send(INITIATE_GAME);
      await reach("active");
      const { id } = state().context.currentGame.props;

      send(SWAP_SIDES);

      expect(lineup.teamsOf(state().context.sides)).toEqual(["2", "1"]);
      expect(state().context.currentGame.props).toMatchObject({ t1: "2", t2: "1" });
      expect(queued("updateGame")).toEqual([
        expect.objectContaining({ id, switched: true }),
      ]);

      // side A's goal now counts for 2
      send(SCORE_POINT, { index: 0 });
      expect(queued("updateGame")).toEqual([
        expect.objectContaining({ id, switched: true, sideAPoints: 1 }),
      ]);
    });

    it("should not let teams switch ends after a goal", async () => {
      offline();
      start({ players: ["1", "2"] });
      send(INITIATE_GAME);
      await reach("active");
      send(SCORE_POINT, { index: 1 });

      send(SWAP_SIDES);

      expect(lineup.teamsOf(state().context.sides)).toEqual(["1", "2"]);
      expect(state().context.currentGame.props).toMatchObject({ t1: "1", t2: "2" });
    });

    it("should offer to resume a game left unfinished while offline", async () => {
      offline();
      start({ players: [{ id: "1" }, { id: "2" }] });
      send(INITIATE_GAME);
      await reach("active");
      send(SCORE_POINT, { index: 0 });
      // nobody plays for a while, so the game is abandoned unfinished
      send(WARN_PAUSE);
      send(PAUSE);
      await reach("inactive");

      actor.stop();
      start({ players: [{ id: "1" }, { id: "2" }] });
      send(INITIATE_GAME);
      await reach("shouldResume");
      expect(state().context.currentGame.teamPoints).toEqual([1, 0]);
    });
  });
});
