const { Machine, interpret } = require("xstate");

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
  MOVE_CURSOR,
  SWITCH_SIDES,
  WARN_PAUSE,
  GAME_ACTIVITY,
  PAUSE,
} = require("./actionTypes");

const { gameConfig } = require("./config");

jest.useFakeTimers();

jest.mock("../utils/helpers", () => ({
  ...jest.requireActual("../utils/helpers"),
  prompt: jest.fn(),
  beep: jest.fn(),
  showCompetition: jest.fn(),
}));

jest.spyOn(api, "updateGame");

const UNKNOWN = "UNKNOWN";

const fsm = Machine(gameConfig);

const init = (context = {}) => fsm.withContext({ ...fsm.context, ...context });

let service;
let machine;
let state;

const setupActive = (
  onTransition,
  target = "active",
  players = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
) => {
  service = interpret(init({ players }))
    .onTransition((state) => {
      if (state.matches(target)) {
        onTransition(state);
      }
    })
    .start();

  service.send(INITIATE_GAME);
};

describe("gameConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with the correct config", () => {
    const { initialState } = fsm;
    expect(initialState.value).toEqual("inactive");

    expect(initialState.context).toEqual({
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

  describe("inactve", () => {
    it("should not change state from an unknown action", () => {
      const nextState = fsm.transition(fsm.initialState, UNKNOWN);
      expect(nextState.changed).toBe(false);
    });

    it("should NOT initiate the game with no players", () => {
      const nextState = fsm.transition(fsm.initialState, INITIATE_GAME);
      expect(nextState.changed).toBe(false);
    });

    it("should initiate registration when unrecognized badge is scanned", (done) => {
      service = interpret(init())
        .onTransition((state) => {
          if (state.value === "registration") {
            expect(state.context.newPlayer.id).toBe(123);
            expect(helpers.prompt.mock.calls[0][0]).toBe(
              "Please wait while I look you up..."
            );
            expect(helpers.prompt.mock.calls[1][0]).toEqual([
              "Enter a name (<10):",
              "",
              "",
            ]);
            done();
          }
        })
        .start();
      service.send({ type: BADGE_SCAN, id: 123 });
    });

    it("should add a player when badge is recognized", (done) => {
      service = interpret(init())
        .onTransition((state) => {
          if (state.value === "inactive" && state.context.players.length) {
            expect(state.context.players).toEqual([
              { id: "12345", alias: "player-exists" },
            ]);
            done();
          }
        })
        .start();
      service.send({ type: BADGE_SCAN, id: "12345" });
    });

    it("should add players to the end of the list", (done) => {
      service = interpret(init({ players: [{ id: "1234", alias: "bar" }] }))
        .onTransition((state) => {
          if (
            state.value === "inactive" &&
            state.context.players.length === 2
          ) {
            expect(state.context.players).toEqual([
              { id: "1234", alias: "bar" },
              { id: "12345", alias: "player-exists" },
            ]);
            expect(state.context.currentGame).toBe(null);
            done();
          }
        })
        .start();
      service.send({ type: BADGE_SCAN, id: "12345" });
    });

    it("should NOT add a player twice", (done) => {
      let render = 0;
      service = interpret(init({ players: [{ id: "12345" }] }))
        .onTransition((state) => {
          render++;
          if (state.value === "inactive" && render > 1) {
            expect(state.context.players).toEqual([{ id: "12345" }]);
            expect(state.context.currentGame).toBe(null);
            done();
          }
        })
        .start();
      service.send({ type: BADGE_SCAN, id: "12345" });
    });

    it("should not exceed 4 players", (done) => {
      service = interpret(
        init({
          players: [
            { id: 1, alias: "foo1" },
            { id: 2, alias: "foo2" },
            { id: 3, alias: "foo3" },
            { id: 4, alias: "foo4" },
          ],
        })
      )
        .onTransition((state) => {
          if (state.value === "inactive" && state.context.players[0].id !== 1) {
            expect(state.context.players).toEqual([
              { id: 2, alias: "foo2" },
              { id: 3, alias: "foo3" },
              { id: 4, alias: "foo4" },
              { id: "12345", alias: "player-exists" },
            ]);
            expect(state.context.currentGame).toBe(null);
            done();
          }
        })
        .start();
      service.send({ type: BADGE_SCAN, id: "12345" });
    });

    it("should initiate the game", () => {
      const { initialState } = init({ players: [1, 2, 3, 4] });
      expect(initialState.value).toBe("inactive");
      const { value, changed } = fsm.transition(initialState, INITIATE_GAME);
      expect(changed).toBe(true);
      expect(value).toBe("pending");
    });
  });

  describe("registration", () => {
    it("should handle inputting an alias", () => {
      machine = init({ newPlayer: { id: 888, alias: "" } });

      state = machine.transition("registration", {
        type: APPEND_CHAR,
        character: "a",
      });
      state = machine.transition(state, { type: APPEND_CHAR, character: "b" });
      state = machine.transition(state, { type: APPEND_CHAR, character: "e" });
      expect(helpers.prompt.mock.calls[0][0][0]).toBe("Enter a name (<10):");
      expect(state.context.newPlayer.alias).toBe("abe");

      state = machine.transition(state, BACKSPACE);
      expect(helpers.prompt).toHaveBeenCalledTimes(4);
      expect(helpers.prompt.mock.calls.map((call) => call[0][2])).toEqual([
        "a",
        "ab",
        "abe",
        "ab",
      ]);

      state = machine.transition(state, CONFIRM);
      expect(state.context.newPlayer).toEqual({ id: 0, alias: "" });
      expect(state.context.players).toEqual([{ id: 888, alias: "ab" }]);
      expect(state.value).toBe("inactive");
    });
  });

  describe("pending", () => {
    it("should automatically start a new game when no unfinished game is found", (done) => {
      setupActive(
        (state) => {
          expect(state.value).toBe("active");
          expect(state.context.currentGame.teamPoints).toEqual([0, 0]);
          expect(state.context.currentGame.competitionId).toEqual("1V2");
          done();
        },
        "active",
        [{ id: 1 }, { id: 2 }]
      );
    });

    it("should move to shouldResume state when an unfinished game is found", (done) => {
      setupActive((state) => {
        expect(state.value).toBe("shouldResume");
        expect(state.context.currentGame.teamPoints).toEqual([4, 3]);
        expect(helpers.prompt.mock.calls[0][0]).toBe(
          "Would you like to resume your previous unfinished game?"
        );
        done();
      }, "shouldResume");
    });
  });

  describe("shouldResume", () => {
    it("should resume the game", () => {
      machine = init({
        players: [1, 2],
        currentGame: Game("1", "2", { sideAPoints: 1, sideBPoints: 3 }),
      });

      state = machine.transition("shouldResume", CONFIRM);
      expect(state.value).toBe("active");
      expect(state.context.currentGame.teamPoints).toEqual([1, 3]);
    });

    it("should reset the current game score and startedAt", () => {
      machine = init({
        players: [1, 2],
        currentGame: Game("1", "2", { sideAPoints: 1, sideBPoints: 3 }),
      });

      state = machine.transition("shouldResume", DENY);
      expect(api.updateGame).toHaveBeenCalledWith(
        expect.objectContaining({
          sideAPoints: 0,
          sideBPoints: 0,
          startedAt: expect.any(String),
        })
      );
      expect(state.context.currentGame.teamPoints).toEqual([0, 0]);
      expect(state.value).toBe("active");
      expect(helpers.prompt).toHaveBeenCalledTimes(1);
    });
  });

  describe("active", () => {
    const defaultGameProps = {
      sideAPoints: 0,
      sideBPoints: 0,
    };

    it("should not change state from an unknown action", () => {
      machine = init({
        players: [1, 2],
        currentGame: Game("1", "2", defaultGameProps),
      });

      state = machine.transition("active", ADD_PLAYER);
      expect(state.changed).toBe(false);
      expect(state.context.currentGame.teamPoints).toEqual([0, 0]);

      state = machine.transition("active", UNKNOWN);
      expect(state.changed).toBe(false);
    });

    it("should make updates on SCORE_POINT", () => {
      machine = init({
        players: [1, 2],
        currentGame: Game("1", "2", defaultGameProps),
      });

      state = machine.transition("active", { type: SCORE_POINT, index: 0 });
      expect(state.context.currentGame.teamPoints).toEqual([1, 0]);

      state = machine.transition("active", { type: SCORE_POINT, index: 1 });
      expect(state.context.currentGame.teamPoints).toEqual([1, 1]);

      expect(api.updateGame).toHaveBeenCalledTimes(2);
    });

    it("should make the game complete when the first team wins", (done) => {
      machine = init({
        players: [1, 2],
        currentGame: Game("1", "2", {
          sideAPoints: 4,
          sideBPoints: 3,
          id: "active-game-id",
        }),
      });
      service = interpret(machine)
        .onTransition((state) => {
          if (state.value === "complete") {
            expect(state.context.currentGame.teamPoints).toEqual([5, 3]);
            expect(state.context.currentGame.props.endedAt).not.toBe(null);
            expect(api.updateGame).toHaveBeenCalledWith(
              expect.objectContaining({ endedAt: expect.any(String) })
            );
            done();
          }
        })
        .start("active");

      service.send(SCORE_POINT, { index: 0 });
    });

    it("should make the game complete when the second team wins", (done) => {
      machine = init({
        players: [1, 2],
        currentGame: Game("1", "2", {
          sideAPoints: 4,
          sideBPoints: 4,
          id: "active-game-id",
        }),
      });
      service = interpret(machine)
        .onTransition((state) => {
          if (state.value === "complete") {
            expect(state.context.currentGame.teamPoints).toEqual([4, 5]);
            expect(state.context.currentGame.props.endedAt).not.toBe(null);
            expect(api.updateGame).toHaveBeenCalledWith(
              expect.objectContaining({ endedAt: expect.any(String) })
            );
            done();
          }
        })
        .start("active");

      service.send(SCORE_POINT, { index: 1 });
    });

    it("should make the game inactive and reset after game completion", (done) => {
      machine = init({
        players: [1, 2],
        currentGame: Game("1", "2", { sideAPoints: 4, sideBPoints: 4 }),
      });
      service = interpret(machine)
        .onTransition((state) => {
          if (state.value === "inactive") {
            expect(state.context.players).toEqual([]);
            expect(state.context.currentGame).toBe(null);
            done();
          }
        })
        .start("active");
      service.send(SCORE_POINT, { index: 1 });
    });
  });

  describe("pauseWarning", () => {
    const gameProps = (extra = {}) => ({
      players: [1, 2],
      currentGame: Game("1", "2", { ...extra, sideAPoints: 4, sideBPoints: 4 }),
    });

    it("should turn on the warning on entry", () => {
      machine = init(gameProps());

      state = machine.transition("active", WARN_PAUSE);
      expect(state.value).toBe("pauseWarning");
      expect(helpers.beep).toHaveBeenCalled();
      expect(helpers.prompt).toHaveBeenCalledWith(
        "Are you still playing this game?"
      );
    });

    it("should go back to active on confirm", () => {
      machine = init(gameProps());

      state = machine.transition("pauseWarning", CONFIRM);
      expect(state.value).toBe("active");
    });

    it("should go back to active when activity detected", () => {
      machine = init(gameProps());

      state = machine.transition("pauseWarning", GAME_ACTIVITY);
      expect(state.value).toBe("active");
    });

    it("should pause and reset the game when denied", () => {
      machine = init(gameProps());

      state = machine.transition("pauseWarning", PAUSE);
      expect(state.value).toBe("inactive");
      expect(state.context.currentGame).toBe(null);
      expect(state.context.players).toEqual([]);
    });
  });
});
