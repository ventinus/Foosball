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

// ---------------- Actions ---------------- //
exports.resetGame = assign({
  players: () => [],
  currentGame: () => null,
  bestOfLimit: () => 1,
  // cursorPosition: () => ({
  //   x: 0,
  //   y: 0,
  // }),
  // selectedPlayerIndices: () => [],
  newPlayer: () => ({
    id: "0",
    alias: "",
  }),
});

exports.addPlayer = assign({
  players: ({ players }, { data }) => addPlayer(players, data),
});

exports.appendCharacter = assign({
  newPlayer: ({ newPlayer }, { character }) => ({
    ...newPlayer,
    alias: `${newPlayer.alias}${character}`.slice(0, 10),
  }),
});

exports.backspace = assign({
  newPlayer: ({ newPlayer }) => ({
    ...newPlayer,
    alias: newPlayer.alias.slice(0, -1),
  }),
});

exports.seedNewPlayer = assign({
  newPlayer: (ctx, event) => ({
    id: `${event.data.id}`,
    alias: "",
  }),
});

exports.updateCompetition = assign(({ players }) => showCompetition(players));

exports.promptSearching = assign(() =>
  prompt("Please wait while I look you up...")
);

exports.promptAliasInput = assign(({ newPlayer }) =>
  prompt(["Enter a name (<10):", "", newPlayer.alias])
);

exports.createPlayer = assign({
  newPlayer: ({ newPlayer }) => {
    Player.create(newPlayer);

    return {
      id: "0",
      alias: "",
    };
  },
  players: ({ players, newPlayer }) => addPlayer(players, newPlayer),
});

exports.scorePoint = assign({
  currentGame: ({ currentGame }, { index }) => {
    currentGame.scorePoint(index);
    return currentGame;
  },
});

exports.promptResume = assign(() =>
  prompt("Would you like to resume your previous unfinished game?")
);

exports.clearPrompt = assign(prompt);

exports.setGame = assign({
  currentGame: (ctx, { data }) => data,
});

exports.createGame = assign({
  currentGame: ({ players }) => {
    const [team1, team2] = formatTeams(players);
    return Game(team1, team2);
  },
});

exports.resetScore = assign(({ currentGame }) => {
  currentGame.resetScore();
  return currentGame;
});

// save current game state
exports.updateGame = assign(({ currentGame }) => {
  currentGame.updateGame();
  return currentGame;
});

exports.deleteGame = assign({
  currentGame: ({ currentGame }) => {
    currentGame.deleteGame();
    return null;
  },
});

exports.setWarning = assign(() => {
  prompt("Are you still playing this game?");
  beep();
});

exports.pauseGame = assign({
  currentGame: ({ currentGame }) => {
    currentGame.pauseGame();
    currentGame.updateGame();
    return currentGame;
  },
});
