const { assign } = require("xstate");
const { Player } = require("../models");
const { prompt, showCompetition, beep } = require("../utils/helpers");
const lineup = require("./lineup");

const emptyNewPlayer = () => ({ id: "0", alias: "" });

// ------------- Context updates ------------- //
exports.resetGame = assign({
  sides: lineup.emptySides,
  currentGame: () => null,
  bestOfLimit: () => 1,
  newPlayer: emptyNewPlayer,
});

// output of the find-player actor
exports.addPlayer = assign({
  sides: ({ context, event }) => lineup.seatPlayer(context.sides, event.output),
});

exports.movePlayer = assign({
  sides: ({ context, event }) =>
    lineup.movePlayer(context.sides, event.id, event.side, event.slot),
});

exports.removePlayer = assign({
  sides: ({ context, event }) => lineup.removePlayer(context.sides, event.id),
});

exports.swapSides = assign({
  sides: ({ context }) => lineup.swapSides(context.sides),
});

exports.appendCharacter = assign({
  newPlayer: ({ context: { newPlayer }, event }) => ({
    ...newPlayer,
    alias: `${newPlayer.alias}${event.character}`.slice(0, 10),
  }),
});

exports.backspace = assign({
  newPlayer: ({ context: { newPlayer } }) => ({
    ...newPlayer,
    alias: newPlayer.alias.slice(0, -1),
  }),
});

// error thrown by the find-player actor carries the unknown badge id
exports.seedNewPlayer = assign({
  newPlayer: ({ event }) => ({
    id: `${event.error.id}`,
    alias: "",
  }),
});

// registration was cancelled or timed out
exports.clearNewPlayer = assign({ newPlayer: emptyNewPlayer });

exports.addNewPlayer = assign({
  sides: ({ context }) => lineup.seatPlayer(context.sides, context.newPlayer),
  newPlayer: emptyNewPlayer,
});

exports.scorePoint = assign({
  currentGame: ({ context: { currentGame }, event }) => {
    currentGame.scorePoint(event.index);
    return currentGame;
  },
});

// find-or-create-game resolves with a new game, or rejects with an unfinished
// one. A resumed game keeps the ends it was played on, so the lineup follows it.
exports.setGame = assign(({ context: { sides }, event }) => {
  const currentGame = event.output ?? event.error;
  const [sideA] = lineup.teamsOf(sides);
  return {
    currentGame,
    sides: currentGame.props.t1 === sideA ? sides : lineup.swapSides(sides),
  };
});

// ------------- Side effects ------------- //
// Saves are fire-and-forget; log failures so an unhandled rejection can't crash the process.
const logFailure = (label) => (err) => console.log(`${label} failed`, err);

exports.updateCompetition = ({ context: { sides } }) =>
  showCompetition(lineup.playersOf(sides));

// A badge scanned with every slot taken; someone has to be removed first.
exports.rejectScan = () => {
  prompt("The table is full. Remove a player to add someone else.");
  beep();
};

exports.switchGameSides = ({ context: { currentGame } }) => {
  currentGame.switchSides().catch(logFailure("switchSides"));
};

exports.promptSearching = () => prompt("Please wait while I look you up...");

exports.promptAliasInput = ({ context: { newPlayer } }) =>
  prompt(["Enter a name (max 10, Esc to cancel):", "", newPlayer.alias]);

exports.createPlayer = ({ context: { newPlayer } }) => {
  Player.create(newPlayer).catch(logFailure("createPlayer"));
};

exports.promptResume = () =>
  prompt("Would you like to resume your previous unfinished game?");

exports.clearPrompt = () => prompt();

exports.resetScore = ({ context: { currentGame } }) => {
  currentGame.resetScore().catch(logFailure("resetScore"));
};

// save current game state
exports.updateGame = ({ context: { currentGame } }) => {
  currentGame.updateGame().catch(logFailure("updateGame"));
};

exports.logCompleteGameFailure = ({ event }) =>
  logFailure("completeGame")(event.error);

exports.setWarning = () => {
  prompt("Are you still playing this game?");
  beep();
};
