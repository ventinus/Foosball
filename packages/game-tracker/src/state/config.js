const {
  INITIATE_GAME,
  BADGE_SCAN,
  ADD_PLAYER,
  APPEND_CHAR,
  BACKSPACE,
  SCORE_POINT,
  CONFIRM,
  DENY,
  SWITCH_SIDES,
  GAME_ACTIVITY,
  WARN_PAUSE,
  PAUSE,
} = require("./actionTypes");

const {
  resetGame,
  addPlayer,
  appendCharacter,
  backspace,
  createPlayer,
  seedNewPlayer,
  updateCompetition,
  promptSearching,
  promptAliasInput,
  switchSides,
  promptResume,
  clearPrompt,
  scorePoint,
  updateGame,
  resetScore,
  setGame,
  setWarning,
} = require("./actions");

const { findOrCreateGame, completeGame, findPlayer } = require("./services");
const { canActivate, notPresent, gameComplete } = require("./guards");

exports.gameConfig = {
  id: "foosball",
  initial: "inactive",
  context: {
    players: [],
    currentGame: null,
    bestOfLimit: 1, // how many games to play to
    cursorPosition: {
      x: 0,
      y: 0,
    },
    selectedPlayerIndices: [],
    newPlayer: {
      id: 0,
      alias: "",
    },
  },
  states: {
    inactive: {
      entry: updateCompetition,
      on: {
        [INITIATE_GAME]: {
          target: "pending",
          cond: canActivate,
        },
        [BADGE_SCAN]: {
          target: "findPlayer",
          cond: notPresent,
        },
      },
    },
    findPlayer: {
      entry: promptSearching,
      invoke: {
        id: "find-player",
        src: findPlayer,
        onDone: {
          target: "inactive",
          actions: addPlayer,
        },
        onError: "registration",
      },
    },
    registration: {
      entry: [seedNewPlayer, promptAliasInput],
      on: {
        [APPEND_CHAR]: {
          actions: [appendCharacter, promptAliasInput],
        },
        [BACKSPACE]: {
          actions: [backspace, promptAliasInput],
        },
        [CONFIRM]: {
          actions: createPlayer,
          target: "inactive",
        },
      },
    },
    pending: {
      exit: [setGame],
      invoke: {
        id: "find-or-create-game",
        src: findOrCreateGame,
        onDone: "active",
        onError: "shouldResume",
      },
    },
    shouldResume: {
      entry: promptResume,
      exit: clearPrompt,
      on: {
        [CONFIRM]: "active",
        [DENY]: {
          target: "active",
          actions: [resetScore],
        },
      },
    },
    active: {
      on: {
        "": {
          target: "complete",
          cond: gameComplete,
        },
        [SCORE_POINT]: {
          actions: [scorePoint, updateGame],
        },
        [WARN_PAUSE]: "pauseWarning",
      },
    },
    pauseWarning: {
      entry: setWarning,
      on: {
        [CONFIRM]: "active",
        [GAME_ACTIVITY]: "active",
        [DENY]: {
          actions: [resetGame],
          target: "inactive",
        },
        [PAUSE]: {
          actions: [resetGame],
          target: "inactive",
        },
      },
    },
    complete: {
      exit: resetGame,
      invoke: {
        id: "complete-game",
        src: completeGame,
        onDone: "inactive",
      },
    },
  },
};
