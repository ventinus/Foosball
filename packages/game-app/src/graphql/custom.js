export const getPlayer = /* GraphQL */ `
  query GetPlayer($fobId: ID!) {
    getPlayer(fobId: $fobId) {
      fobId
      alias
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
      }
      nextToken
    }
  }
`;

export const onUpdateGame = /* GraphQL */ `
  subscription OnUpdateGame {
    onUpdateGame {
      id
      sideAPoints
      sideBPoints
      startedAt
      endedAt
    }
  }
`;
