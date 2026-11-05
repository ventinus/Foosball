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
} = require("./actionTypes");

const actions = require("./actions");
const actors = require("./services");
const guards = require("./guards");
const lineup = require("./lineup");
const { minToMs } = require("../utils/helpers");

// An unknown badge with nobody typing returns the table to `inactive`.
const REGISTRATION_TIMEOUT_MS = minToMs(2);
exports.REGISTRATION_TIMEOUT_MS = REGISTRATION_TIMEOUT_MS;

exports.initialContext = {
  sides: lineup.emptySides(), // see lineup.js
  currentGame: null,
  bestOfLimit: 1, // how many games to play to
  newPlayer: {
    id: 0,
    alias: "",
  },
};

exports.gameMachine = setup({
  actions,
  actors,
  guards,
  delays: { registrationTimeout: REGISTRATION_TIMEOUT_MS },
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
      entry: "promptAliasInput",
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
        [SWAP_SIDES]: {
          guard: "noGoals",
          actions: ["swapSides", "switchGameSides"],
        },
        [WARN_PAUSE]: "pauseWarning",
      },
    },
    pauseWarning: {
      entry: "setWarning",
      on: {
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
    complete: {
      exit: "resetGame",
      invoke: {
        id: "complete-game",
        src: "completeGame",
        input: ({ context }) => ({ currentGame: context.currentGame }),
        onDone: "inactive",
        // Saves are queued locally (src/sync), so this only fails if that
        // does; don't get stuck here if it happens.
        onError: {
          target: "inactive",
          actions: "logCompleteGameFailure",
        },
      },
    },
  },
});
