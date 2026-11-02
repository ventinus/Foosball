const { fromPromise } = require("xstate");
const { Game, Player } = require("../models");
const { formatTeams, toCompetitionId } = require("../utils");
const sync = require("../sync");

// The game is created locally (with its own id) and sent to the API when it's
// reachable, so play can start while the table is offline.
const createGame = async ({ players }) => {
  const [team1, team2] = formatTeams(players);
  const game = sync.createGame({
    competitionId: toCompetitionId(team1, team2),
    playerIds: players.map(({ id }) => `${id}`),
    switched: false, // TODO: how to determine?
  });
  return Game(team1, team2, game);
};

exports.createGame = createGame;

// Rejects with the unfinished Game (not an Error) so the machine can offer to resume it.
exports.findOrCreateGame = fromPromise(async ({ input: { players } }) => {
  const [team1, team2] = formatTeams(players);

  const competitionId = toCompetitionId(team1, team2);

  const game = await sync.findUnfinishedGame(competitionId);
  if (game) throw Game(team1, team2, game);

  return await createGame({ players });
});

exports.completeGame = fromPromise(({ input: { currentGame } }) =>
  currentGame.endGame()
);

// Rejects with { id } when the badge isn't registered yet.
exports.findPlayer = fromPromise(async ({ input: { id } }) => {
  const player = await Player.find(id);

  if (!player) throw { id };

  return player;
});
