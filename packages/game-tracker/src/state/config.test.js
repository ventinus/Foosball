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
} = require("./actionTypes");

const { gameMachine, initialContext } = require("./config");

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

// Start a fresh actor in the initial state, seeding part of the context.
const start = (context = {}) =>
  (actor = createActor(gameMachine, { input: context }).start());

// Start an actor directly in `value` (entry actions for that state do not run).
const startAt = (value, context = {}) => {
  const snapshot = gameMachine.resolveState({
    value,
    context: { ...initialContext, ...context },
  });
  return (actor = createActor(gameMachine, { snapshot }).start());
};

const send = (type, payload = {}) => actor.send({ type, ...payload });
const state = () => actor.getSnapshot();
const reach = (value) => waitFor(actor, (s) => s.matches(value));

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
      players: [],
      currentGame: null,
      bestOfLimit: 1,
      cursorPosition: {
        x: 0,
        y: 0,
      },
      selectedPlayerIndices: [],
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
        "Enter a name (<10):",
        "",
        "",
      ]);
    });

    it("should add a player when badge is recognized", async () => {
      start();
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(
        actor,
        (s) => s.matches("inactive") && s.context.players.length > 0
      );

      expect(state().context.players).toEqual([
        { id: "12345", alias: "player-exists" },
      ]);
    });

    it("should add players to the end of the list", async () => {
      start({ players: [{ id: "1234", alias: "bar" }] });
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(
        actor,
        (s) => s.matches("inactive") && s.context.players.length === 2
      );

      expect(state().context.players).toEqual([
        { id: "1234", alias: "bar" },
        { id: "12345", alias: "player-exists" },
      ]);
      expect(state().context.currentGame).toBe(null);
    });

    it("should NOT add a player twice", () => {
      start({ players: [{ id: "12345" }] });
      send(BADGE_SCAN, { id: "12345" });

      expect(state().value).toBe("inactive");
      expect(state().context.players).toEqual([{ id: "12345" }]);
      expect(state().context.currentGame).toBe(null);
    });

    it("should NOT add a player twice when the reader sends a numeric id", () => {
      // the API returns fobId as a string; the RFID reader sends a number
      start({ players: [{ id: "12345", alias: "player-exists" }] });
      send(BADGE_SCAN, { id: 12345 });

      expect(state().value).toBe("inactive");
      expect(state().context.players).toHaveLength(1);
    });

    it("should not exceed 4 players", async () => {
      start({
        players: [
          { id: 1, alias: "foo1" },
          { id: 2, alias: "foo2" },
          { id: 3, alias: "foo3" },
          { id: 4, alias: "foo4" },
        ],
      });
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(
        actor,
        (s) => s.matches("inactive") && s.context.players[0].id !== 1
      );

      expect(state().context.players).toEqual([
        { id: 2, alias: "foo2" },
        { id: 3, alias: "foo3" },
        { id: 4, alias: "foo4" },
        { id: "12345", alias: "player-exists" },
      ]);
      expect(state().context.currentGame).toBe(null);
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
      expect(state().context.currentGame.competitionId).toBe("1::2V3");
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
      expect(helpers.prompt.mock.calls[0][0][0]).toBe("Enter a name (<10):");
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
      expect(state().context.players).toEqual([{ id: "888", alias: "ab" }]);
      expect(state().value).toBe("inactive");
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
      start({ players: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
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

    it("should make the game complete when the first team wins", () => {
      const currentGame = Game("1", "2", {
        sideAPoints: 4,
        sideBPoints: 3,
        id: "active-game-id",
      });
      startAt("active", { players: [1, 2], currentGame });

      send(SCORE_POINT, { index: 0 });
      expect(state().value).toBe("complete");
      expect(currentGame.teamPoints).toEqual([5, 3]);
      expect(currentGame.props.endedAt).not.toBe(null);
      expect(queued("updateGame")).toContainEqual(
        expect.objectContaining({ endedAt: expect.any(String) })
      );
    });

    it("should make the game complete when the second team wins", () => {
      const currentGame = Game("1", "2", {
        sideAPoints: 4,
        sideBPoints: 4,
        id: "active-game-id",
      });
      startAt("active", { players: [1, 2], currentGame });

      send(SCORE_POINT, { index: 1 });
      expect(state().value).toBe("complete");
      expect(currentGame.teamPoints).toEqual([4, 5]);
      expect(currentGame.props.endedAt).not.toBe(null);
      expect(queued("updateGame")).toContainEqual(
        expect.objectContaining({ endedAt: expect.any(String) })
      );
    });

    it("should make the game inactive and reset after game completion", async () => {
      startAt("active", {
        players: [1, 2],
        currentGame: Game("1", "2", { sideAPoints: 4, sideBPoints: 4 }),
      });
      send(SCORE_POINT, { index: 1 });
      await reach("inactive");

      expect(state().context.players).toEqual([]);
      expect(state().context.currentGame).toBe(null);
    });

    it("should return to inactive and reset when saving the completed game fails", async () => {
      const log = jest.spyOn(console, "log").mockImplementation(() => null);
      const currentGame = Game("1", "2", { sideAPoints: 4, sideBPoints: 4 });
      jest
        .spyOn(currentGame, "endGame")
        .mockRejectedValueOnce(new Error("disk full"));
      startAt("active", { players: [1, 2], currentGame });
      send(SCORE_POINT, { index: 1 });
      await reach("inactive");

      expect(state().context.players).toEqual([]);
      expect(state().context.currentGame).toBe(null);
      expect(log).toHaveBeenCalledWith(
        "completeGame failed",
        expect.any(Error)
      );
      log.mockRestore();
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

    it("should pause and reset the game when denied", () => {
      startAt("pauseWarning", gameProps());

      send(PAUSE);
      expect(state().value).toBe("inactive");
      expect(state().context.currentGame).toBe(null);
      expect(state().context.players).toEqual([]);
    });
  });

  describe("offline", () => {
    const offline = () => {
      jest.spyOn(console, "log").mockImplementation(() => null);
      const down = () => Promise.reject(new Error("network down"));
      jest.spyOn(api, "findPlayer").mockImplementation(down);
      jest.spyOn(api, "getCurrentGame").mockImplementation(down);
    };

    it("should recognize a player seen before while offline", async () => {
      start();
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(actor, (s) => s.context.players.length === 1);

      offline();
      actor.stop();
      start();
      send(BADGE_SCAN, { id: "12345" });
      await waitFor(actor, (s) => s.context.players.length === 1);

      expect(state().context.players).toEqual([
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

      expect(state().context.players).toEqual([{ id: "777", alias: "z" }]);
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

      for (let i = 0; i < 5; i++) send(SCORE_POINT, { index: 1 });
      await reach("inactive");

      expect(queued("createGame")).toEqual([
        expect.objectContaining({ id, competitionId: "1::2V3", type: "Game" }),
      ]);
      expect(queued("createPlayerGames").map((pg) => pg.playerID)).toEqual([
        "1",
        "2",
        "3",
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
