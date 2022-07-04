const { API, graphqlOperation } = require("aws-amplify");
const _get = require("lodash/get");

const { formatTeams, toCompetitionId } = require("../utils");
const gql = require("../graphql/custom");

const executeRequest = (action, options = {}) =>
  API.graphql(
    graphqlOperation(action, {
      ...options,
      // , authMode: 'AMAZON_COGNITO_USER_POOLS'
    })
  );

exports.getCurrentGame = async (competitionId) => {
  const { data } = await executeRequest(gql.gameByCompetition, {
    competitionId,
    sortDirection: "DESC",
    limit: 1,
    filter: { endedAt: { attributeExists: false } },
  });
  return _get(data, "gameByCompetition.items[0]", null);
};

exports.createGame = async (input, ...players) => {
  const [team1, team2] = formatTeams(players);
  const competitionId = toCompetitionId(team1, team2);

  const { data } = await executeRequest(gql.createGame, {
    input: {
      ...input,
      competitionId,
      startedAt: new Date().toISOString(),
      sideAPoints: 0,
      sideBPoints: 0,
      type: "Game",
    },
  });
  const gameID = data.createGame.id;
  // create the player games
  await Promise.all(
    players.map(({ fobId: playerID }) =>
      executeRequest(gql.createPlayerGames, {
        input: {
          gameID,
          playerID,
        },
      })
    )
  );
  return data.createGame;
};

exports.updateGame = async (input) => {
  const { data } = await executeRequest(gql.updateGame, { input });
  return data.updateGame;
};

exports.findPlayer = async (fobId) => {
  try {
    const { data } = await executeRequest(gql.getPlayer, { fobId });
    return data.getPlayer;
  } catch (err) {
    console.log("findPlayer err", err);
    throw err;
  }
};

exports.createPlayer = async ({ fobId, alias }) => {
  try {
    const { data } = await executeRequest(gql.createPlayer, {
      input: {
        fobId,
        alias,
        type: "Player",
      },
    });
    return data.createPlayer;
  } catch (err) {
    console.log("updateCurrent err", err);
    throw err;
  }
};
