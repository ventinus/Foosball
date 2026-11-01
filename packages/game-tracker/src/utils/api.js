const { generateClient } = require("aws-amplify/api");
const _get = require("lodash/get");

const { formatTeams, toCompetitionId } = require("../utils");
const gql = require("../graphql/custom");

// Created lazily so Amplify.configure() has run before the client is built.
let client;
const executeRequest = (query, variables = {}) => {
  client ??= generateClient();
  return client.graphql({ query, variables });
};

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
    players.map(({ id: playerID }) =>
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
    if (data.getPlayer) {
      return { alias: data.getPlayer.alias, id: data.getPlayer.fobId };
    }
    return null;
  } catch (err) {
    console.log("findPlayer err", err);
    throw err;
  }
};

exports.createPlayer = async ({ id, alias }) => {
  try {
    await executeRequest(gql.createPlayer, {
      input: {
        fobId: id,
        alias,
        type: "Player",
      },
    });
    return { id, alias };
  } catch (err) {
    console.log("updateCurrent err", err);
    throw err;
  }
};
