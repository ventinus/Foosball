/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getPlayer = /* GraphQL */ `
  query GetPlayer($fobId: ID!) {
    getPlayer(fobId: $fobId) {
      fobId
      alias
      type
      games {
        items {
          id
          playerID
          gameID
          createdAt
          updatedAt
        }
        nextToken
      }
      createdAt
      updatedAt
    }
  }
`;
export const listPlayers = /* GraphQL */ `
  query ListPlayers(
    $fobId: ID
    $filter: ModelPlayerFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listPlayers(
      fobId: $fobId
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        fobId
        alias
        type
        games {
          nextToken
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
export const getGame = /* GraphQL */ `
  query GetGame($id: ID!) {
    getGame(id: $id) {
      id
      switched
      sideAPoints
      sideBPoints
      startedAt
      endedAt
      competitionId
      type
      players {
        items {
          id
          playerID
          gameID
          createdAt
          updatedAt
        }
        nextToken
      }
      createdAt
      updatedAt
    }
  }
`;
export const listGames = /* GraphQL */ `
  query ListGames(
    $filter: ModelGameFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listGames(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        switched
        sideAPoints
        sideBPoints
        startedAt
        endedAt
        competitionId
        type
        players {
          nextToken
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
export const getPlayerGames = /* GraphQL */ `
  query GetPlayerGames($id: ID!) {
    getPlayerGames(id: $id) {
      id
      playerID
      gameID
      player {
        fobId
        alias
        type
        games {
          nextToken
        }
        createdAt
        updatedAt
      }
      game {
        id
        switched
        sideAPoints
        sideBPoints
        startedAt
        endedAt
        competitionId
        type
        players {
          nextToken
        }
        createdAt
        updatedAt
      }
      createdAt
      updatedAt
    }
  }
`;
export const listPlayerGames = /* GraphQL */ `
  query ListPlayerGames(
    $filter: ModelPlayerGamesFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listPlayerGames(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        playerID
        gameID
        player {
          fobId
          alias
          type
          createdAt
          updatedAt
        }
        game {
          id
          switched
          sideAPoints
          sideBPoints
          startedAt
          endedAt
          competitionId
          type
          createdAt
          updatedAt
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
export const playersByAlias = /* GraphQL */ `
  query PlayersByAlias(
    $type: String!
    $alias: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelPlayerFilterInput
    $limit: Int
    $nextToken: String
  ) {
    playersByAlias(
      type: $type
      alias: $alias
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        fobId
        alias
        type
        games {
          nextToken
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
export const gameByCompetition = /* GraphQL */ `
  query GameByCompetition(
    $competitionId: ID!
    $startedAt: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelGameFilterInput
    $limit: Int
    $nextToken: String
  ) {
    gameByCompetition(
      competitionId: $competitionId
      startedAt: $startedAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        switched
        sideAPoints
        sideBPoints
        startedAt
        endedAt
        competitionId
        type
        players {
          nextToken
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
export const gamesByStartedAt = /* GraphQL */ `
  query GamesByStartedAt(
    $type: String!
    $startedAt: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelGameFilterInput
    $limit: Int
    $nextToken: String
  ) {
    gamesByStartedAt(
      type: $type
      startedAt: $startedAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        switched
        sideAPoints
        sideBPoints
        startedAt
        endedAt
        competitionId
        type
        players {
          nextToken
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
