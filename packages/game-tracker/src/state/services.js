const { fromPromise } = require("xstate");
const { Game, Player } = require("../models");
const {
  formatTeams,
  toCompetitionId,
  isSwitched,
  sideTeams,
} = require("../utils");
const sync = require("../sync");

// The game is created locally (with its own id) and sent to the API when it's
// reachable, so play can start while the table is offline.
const createGame = async ({ players }) => {
  const [team1, team2] = formatTeams(players);
  const game = sync.createGame({
    competitionId: toCompetitionId(team1, team2),
    playerIds: players.map(({ id }) => `${id}`),
    // team1 plays side A (goal sensor 0)
    switched: isSwitched(team1, team2),
  });
  return Game(team1, team2, game);
};

exports.createGame = createGame;

// Rejects with the unfinished Game (not an Error) so the machine can offer to resume it.
exports.findOrCreateGame = fromPromise(async ({ input: { players } }) => {
  const [team1, team2] = formatTeams(players);

  const competitionId = toCompetitionId(team1, team2);

  // Resume on the ends the game was played on, so its side A/B points stay
  // with the right teams whatever order the badges were scanned in this time.
  const game = await sync.findUnfinishedGame(competitionId);
  if (game) throw Game(...sideTeams(competitionId, game.switched), game);

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
