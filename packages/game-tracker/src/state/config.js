const { setup } = require("xstate");

const {
  INITIATE_GAME,
  BADGE_SCAN,
  APPEND_CHAR,
  BACKSPACE,
  SCORE_POINT,
  CONFIRM,
  DENY,
  GAME_ACTIVITY,
  WARN_PAUSE,
  PAUSE,
  MOVE_PLAYER,
  REMOVE_PLAYER,
  SWAP_SIDES,
  UNDO_GOAL,
  ABANDON,
  SET_ALIAS,
  REMATCH,
} = require("./actionTypes");

const actions = require("./actions");
const actors = require("./services");
const guards = require("./guards");
const lineup = require("./lineup");
const { minToMs } = require("../utils/helpers");

// An unknown badge with nobody typing returns the table to `inactive`.
const REGISTRATION_TIMEOUT_MS = minToMs(2);
exports.REGISTRATION_TIMEOUT_MS = REGISTRATION_TIMEOUT_MS;

// A finished game can have its last goal undone for this long before it's
// saved as finished (a false trigger on the winning goal).
const UNDO_WINDOW_MS = 10 * 1000;
exports.UNDO_WINDOW_MS = UNDO_WINDOW_MS;

// The final score stays up with a Rematch option for this long in all.
const REMATCH_WINDOW_MS = 60 * 1000;
exports.REMATCH_WINDOW_MS = REMATCH_WINDOW_MS;

exports.initialContext = {
  sides: lineup.emptySides(), // see lineup.js
  currentGame: null,
  bestOfLimit: 1, // how many games to play to
  deadline: null, // when the current countdown ends (ms since epoch)
  newPlayer: {
    id: 0,
    alias: "",
  },
};

exports.gameMachine = setup({
  actions,
  actors,
  guards,
  delays: {
    registrationTimeout: REGISTRATION_TIMEOUT_MS,
    undoWindow: UNDO_WINDOW_MS,
    rematchWindow: REMATCH_WINDOW_MS - UNDO_WINDOW_MS,
  },
}).createMachine({
  id: "foosball",
  initial: "inactive",
  // `input` lets callers (and tests) seed part of the context
  context: ({ input }) => ({ ...exports.initialContext, ...input }),
  states: {
    inactive: {
      entry: "updateCompetition",
      on: {
        [INITIATE_GAME]: {
          target: "pending",
          guard: "canActivate",
        },
        [BADGE_SCAN]: [
          { guard: "tableFull", actions: "rejectScan" },
          { target: "findPlayer", guard: "notPresent" },
        ],
        // Re-entering re-prints the lineup.
        [MOVE_PLAYER]: { target: "inactive", reenter: true, actions: "movePlayer" },
        [REMOVE_PLAYER]: { target: "inactive", reenter: true, actions: "removePlayer" },
        [SWAP_SIDES]: { target: "inactive", reenter: true, actions: "swapSides" },
      },
    },
    findPlayer: {
      entry: "promptSearching",
      invoke: {
        id: "find-player",
        src: "findPlayer",
        input: ({ event }) => ({ id: event.id }),
        onDone: {
          target: "inactive",
          actions: "addPlayer",
        },
        onError: {
          target: "registration",
          actions: "seedNewPlayer",
        },
      },
    },
    registration: {
      entry: [
        { type: "setDeadline", params: { ms: REGISTRATION_TIMEOUT_MS } },
        "promptAliasInput",
      ],
      // Re-entering on each keystroke re-prompts and restarts the timeout.
      after: {
        registrationTimeout: {
          target: "inactive",
          actions: "clearNewPlayer",
        },
      },
      on: {
        [APPEND_CHAR]: {
          target: "registration",
          reenter: true,
          actions: "appendCharacter",
        },
        [BACKSPACE]: {
          target: "registration",
          reenter: true,
          actions: "backspace",
        },
        [SET_ALIAS]: {
          target: "registration",
          reenter: true,
          actions: "setAlias",
        },
        [CONFIRM]: {
          guard: "hasAlias",
          actions: ["createPlayer", "addNewPlayer"],
          target: "inactive",
        },
        [DENY]: {
          target: "inactive",
          actions: "clearNewPlayer",
        },
      },
    },
    pending: {
      invoke: {
        id: "find-or-create-game",
        src: "findOrCreateGame",
        input: ({ context }) => ({ sides: context.sides }),
        onDone: {
          target: "active",
          actions: "setGame",
        },
        onError: {
          target: "shouldResume",
          actions: "setGame",
        },
      },
    },
    shouldResume: {
      entry: "promptResume",
      exit: "clearPrompt",
      on: {
        [CONFIRM]: "active",
        [DENY]: {
          target: "active",
          actions: "resetScore",
        },
      },
    },
    active: {
      always: {
        target: "complete",
        guard: "gameComplete",
      },
      on: {
        [SCORE_POINT]: {
          actions: ["scorePoint", "updateGame"],
        },
        [UNDO_GOAL]: {
          guard: "canUndo",
          actions: ["undoGoal", "updateGame"],
        },
        [SWAP_SIDES]: {
          guard: "noGoals",
          actions: ["swapSides", "switchGameSides"],
        },
        [WARN_PAUSE]: "pauseWarning",
        // Leaves the game unfinished, so it can be resumed later.
        [ABANDON]: {
          actions: "resetGame",
          target: "inactive",
        },
      },
    },
    pauseWarning: {
      entry: ["setPauseDeadline", "setWarning"],
      on: {
        [ABANDON]: {
          actions: "resetGame",
          target: "inactive",
        },
        [CONFIRM]: "active",
        [GAME_ACTIVITY]: "active",
        [DENY]: {
          actions: "resetGame",
          target: "inactive",
        },
        [PAUSE]: {
          actions: "resetGame",
          target: "inactive",
        },
      },
    },
    // The final score stays up. For the first UNDO_WINDOW_MS the winning goal
    // can be undone; then the game is saved as finished. Rematch (any time
    // here) saves it straight away and starts the same lineup again. A badge
    // scan or the end of the window clears the table.
    complete: {
      initial: "confirming",
      on: {
        [REMATCH]: "rematch",
      },
      states: {
        confirming: {
          entry: { type: "setDeadline", params: { ms: UNDO_WINDOW_MS } },
          after: { undoWindow: "saving" },
          on: {
            [UNDO_GOAL]: {
              guard: "canUndo",
              target: "#foosball.active",
              actions: ["undoGoal", "updateGame"],
            },
          },
        },
        saving: {
          invoke: {
            id: "complete-game",
            src: "completeGame",
            input: ({ context }) => ({ currentGame: context.currentGame }),
            onDone: "saved",
            // Saves are queued locally (src/sync), so this only fails if that
            // does; don't get stuck here if it happens.
            onError: { target: "saved", actions: "logCompleteGameFailure" },
          },
        },
        saved: {
          entry: {
            type: "setDeadline",
            params: { ms: REMATCH_WINDOW_MS - UNDO_WINDOW_MS },
          },
          after: {
            rematchWindow: { target: "#foosball.inactive", actions: "resetGame" },
          },
          on: {
            [BADGE_SCAN]: {
              target: "#foosball.inactive",
              actions: ["resetGame", "replayEvent"],
            },
          },
        },
      },
    },
    rematch: {
      invoke: {
        id: "start-rematch",
        src: "startRematch",
        input: ({ context: { currentGame, sides } }) => ({ currentGame, sides }),
        onDone: { target: "active", actions: "setGame" },
        onError: {
          target: "inactive",
          actions: ["logCompleteGameFailure", "resetGame"],
        },
      },
    },
  },
});
