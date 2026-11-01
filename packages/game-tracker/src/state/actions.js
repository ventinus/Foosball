const { assign } = require("xstate");
const { Game, Player } = require("../models");
const {
  formatTeams,
  prompt,
  showCompetition,
  beep,
} = require("../utils/helpers");

const addPlayer = (players, newPlayer) => {
  const next = players.concat(newPlayer);
  return next.length > 4 ? next.slice(1) : next;
};

const emptyNewPlayer = () => ({ id: "0", alias: "" });

// ------------- Context updates ------------- //
exports.resetGame = assign({
  players: () => [],
  currentGame: () => null,
  bestOfLimit: () => 1,
  newPlayer: emptyNewPlayer,
});

// output of the find-player actor
exports.addPlayer = assign({
  players: ({ context, event }) => addPlayer(context.players, event.output),
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

exports.addNewPlayer = assign({
  players: ({ context }) => addPlayer(context.players, context.newPlayer),
  newPlayer: emptyNewPlayer,
});

exports.scorePoint = assign({
  currentGame: ({ context: { currentGame }, event }) => {
    currentGame.scorePoint(event.index);
    return currentGame;
  },
});

// find-or-create-game resolves with a new game, or rejects with an unfinished one
exports.setGame = assign({
  currentGame: ({ event }) => event.output ?? event.error,
});

exports.createGame = assign({
  currentGame: ({ context: { players } }) => {
    const [team1, team2] = formatTeams(players);
    return Game(team1, team2);
  },
});

// ------------- Side effects ------------- //
// Saves are fire-and-forget; log failures so an unhandled rejection can't crash the process.
const logFailure = (label) => (err) => console.log(`${label} failed`, err);

exports.updateCompetition = ({ context: { players } }) =>
  showCompetition(players);

exports.promptSearching = () => prompt("Please wait while I look you up...");

exports.promptAliasInput = ({ context: { newPlayer } }) =>
  prompt(["Enter a name (<10):", "", newPlayer.alias]);

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

exports.setWarning = () => {
  prompt("Are you still playing this game?");
  beep();
};
