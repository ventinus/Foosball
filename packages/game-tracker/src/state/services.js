const { fromPromise } = require("xstate");
const { Game, Player } = require("../models");
const { toCompetitionId, isSwitched, sideTeams } = require("../utils");
const lineup = require("./lineup");
const sync = require("../sync");

// The game is created locally (with its own id) and sent to the API when it's
// reachable, so play can start while the table is offline.
const createGame = async ({ sides }) => {
  const [sideA, sideB] = lineup.teamsOf(sides);
  const game = sync.createGame({
    competitionId: toCompetitionId(sideA, sideB),
    playerIds: lineup.playersOf(sides).map(({ id }) => `${id}`),
    switched: isSwitched(sideA, sideB),
  });
  return Game(sideA, sideB, game);
};

exports.createGame = createGame;

// Rejects with the unfinished Game (not an Error) so the machine can offer to resume it.
exports.findOrCreateGame = fromPromise(async ({ input: { sides } }) => {
  const competitionId = toCompetitionId(...lineup.teamsOf(sides));

  // Resume on the ends the game was played on, so its side A/B points stay
  // with the right teams whatever order the badges were scanned in this time.
  const game = await sync.findUnfinishedGame(competitionId);
  if (game) throw Game(...sideTeams(competitionId, game.switched), game);

  return await createGame({ sides });
});

exports.completeGame = fromPromise(({ input: { currentGame } }) =>
  currentGame.endGame()
);

// Saves the finished game (if the undo window hadn't yet) and starts a new
// one for the same lineup.
exports.startRematch = fromPromise(async ({ input: { currentGame, sides } }) => {
  if (!currentGame.completed) await currentGame.endGame();
  return createGame({ sides });
});

// Rejects with { id } when the badge isn't registered yet.
exports.findPlayer = fromPromise(async ({ input: { id } }) => {
  const player = await Player.find(id);

  if (!player) throw { id };

  return player;
});
