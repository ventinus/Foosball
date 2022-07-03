const { assign } = require("xstate");
const { Game, Player } = require("../models");
const { formatTeams, toCompetitionId } = require("../utils");
const api = require("../utils/api");

const createGame = async ({ players }) => {
  const [team1, team2] = formatTeams(players);
  const competitionId = toCompetitionId(team1, team2);

  const game = await api.createGame(
    {
      competitionId,
      switched: false, // TODO: how to determine?
    },
    ...players
  );
  return Game(team1, team2, game);
};

exports.createGame = createGame;

exports.findOrCreateGame = async ({ players }) => {
  const [team1, team2] = formatTeams(players);

  const competitionId = toCompetitionId(team1, team2);
  let game = await api.getCurrentGame(competitionId);

  if (game) throw Game(team1, team2, game);

  // create the game
  return await createGame({ players });
};

exports.completeGame = ({ currentGame }) => currentGame.endGame();

exports.findPlayer = async (ctx, { id }) => {
  const player = await Player.find(id);

  if (!player) throw { id };

  return player;
};
