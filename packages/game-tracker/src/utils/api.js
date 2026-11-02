const { generateClient } = require("aws-amplify/api");
const _get = require("lodash/get");

const gql = require("../graphql/custom");

// Created lazily so Amplify.configure() has run before the client is built.
let client;
const executeRequest = (query, variables = {}) => {
  client ??= generateClient();
  return client.graphql({ query, variables });
};

// ---------------- Reads ----------------- //

exports.getCurrentGame = async (competitionId) => {
  const { data } = await executeRequest(gql.gameByCompetition, {
    competitionId,
    sortDirection: "DESC",
    limit: 1,
    filter: { endedAt: { attributeExists: false } },
  });
  return _get(data, "gameByCompetition.items[0]", null);
};

exports.findPlayer = async (fobId) => {
  const { data } = await executeRequest(gql.getPlayer, { fobId });
  return data.getPlayer
    ? { alias: data.getPlayer.alias, id: data.getPlayer.fobId }
    : null;
};

exports.listPlayers = async () => {
  const players = [];
  let nextToken = null;
  do {
    const { data } = await executeRequest(gql.playersByAlias, {
      type: "Player",
      limit: 1000,
      nextToken,
    });
    players.push(
      ...data.playersByAlias.items.map(({ fobId, alias }) => ({ id: fobId, alias }))
    );
    nextToken = data.playersByAlias.nextToken;
  } while (nextToken);
  return players;
};

// ---------------- Writes ----------------- //
// Called by the sync outbox (src/sync), which builds the full inputs,
// including client-generated ids, so each write can be retried safely.

exports.createPlayer = (input) => executeRequest(gql.createPlayer, { input });

exports.createGame = (input) => executeRequest(gql.createGame, { input });

exports.createPlayerGames = (input) =>
  executeRequest(gql.createPlayerGames, { input });

exports.updateGame = (input) => executeRequest(gql.updateGame, { input });
