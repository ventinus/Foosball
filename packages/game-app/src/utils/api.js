import { API, graphqlOperation } from "aws-amplify";
import * as mutations from "@/graphql/mutations";
import * as custom from "@/graphql/custom";

import _get from "lodash/get";

export const executeRequest = (action, options = {}) => {
  return API.graphql(
    graphqlOperation(action, {
      ...options,
      // , authMode: 'AMAZON_COGNITO_USER_POOLS'
    })
  );
};

// ####################
//       Player
// ####################

export const createPlayer = async ({ alias, fobId }) => {
  const { data } = await executeRequest(custom.createPlayer, {
    input: {
      alias,
      fobId,
      type: "Player",
    },
  });
  return data.createPlayer;
};

export const getPlayer = async (fobId) => {
  const { data } = await executeRequest(custom.getPlayer, { fobId });
  return data.getPlayer;
};

export const updatePlayer = async (details) => {
  const { data } = await executeRequest(mutations.updatePlayer, {
    input: details,
  });
  return data.updatePlayer;
};

export const deletePlayer = async (id) => {
  await executeRequest(mutations.deletePlayer, { input: { id } });
};

export const listPlayers = async ({ alias, filter, limit = 20, nextToken }) => {
  const {
    data: { playersByAlias },
  } = await executeRequest(custom.playersByAlias, {
    type: "Player",
    sortDirection: "ASC",
    alias,
    filter,
    limit,
    nextToken,
  });
  return { players: playersByAlias.items, nextToken: playersByAlias.nextToken };
};

// ####################
//       Game
// ####################

// export const createGame = async (details) => {
//   const { data } = await executeRequest(mutations.createGame, {
//     input: details,
//   });
//   // TODO: make calls to createPlayerGames providing the fobId and the created gameId for each player
//   return data.createGame;
// };

export const getGame = async (id) => {
  const { data } = await executeRequest(custom.getGame, {
    id,
  });
  return data.getGame;
};

export const getCompetitionGames = async ({ competitionId, nextToken }) => {
  const { data } = await executeRequest(custom.gameByCompetition, {
    competitionId,
    limit: 100,
    nextToken,
    sortDirection: "DESC",
  });
  return data.gameByCompetition;
};

// export const updateGame = async (details) => {
//   const { data } = await executeRequest(mutations.updateGame, {
//     input: details,
//   });
//   return data.updateGame;
// };

// export const deleteGame = async (id) => {
//   await executeRequest(mutations.deleteGame, { input: { id } });
// };

export const listGames = async ({ filter, limit = 10, nextToken }) => {
  const {
    data: { gamesByStartedAt: response },
  } = await executeRequest(custom.gamesByStartedAt, {
    type: "Game",
    sortDirection: "DESC",
    filter,
    limit,
    nextToken,
  });
  return { games: response.items, nextToken: response.nextToken };
};

export const listActiveGames = ({ limit, nextToken }) =>
  listGames({
    filter: { endedAt: { attributeExists: false } },
    limit,
    nextToken,
  });

export const listRecentGames = ({ limit, nextToken }) =>
  listGames({
    filter: { endedAt: { attributeExists: true } },
    limit,
    nextToken,
  });

export const onUpdateGame = (callback) => {
  const subscription = executeRequest(custom.onUpdateGame).subscribe({
    next: (payload) => {
      return callback(payload.value.data.onUpdateGame);
    },
    error: (error) => {
      // console.error("onUpdateGame error", error);
    },
  });

  return subscription.unsubscribe;
};
