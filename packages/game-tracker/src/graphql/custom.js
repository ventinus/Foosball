// *********************************
// QUERIES
// *********************************
exports.getPlayer = /* GraphQL */ `
  query GetPlayer($fobId: ID!) {
    getPlayer(fobId: $fobId) {
      fobId
      alias
    }
  }
`;

exports.gameByCompetition = /* GraphQL */ `
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
        updatedAt
      }
      nextToken
    }
  }
`;

// *********************************
// MUTATIONS
// *********************************
exports.createPlayer = /* GraphQL */ `
  mutation CreatePlayer(
    $input: CreatePlayerInput!
    $condition: ModelPlayerConditionInput
  ) {
    createPlayer(input: $input, condition: $condition) {
      fobId
      alias
    }
  }
`;

exports.createGame = /* GraphQL */ `
  mutation CreateGame(
    $input: CreateGameInput!
    $condition: ModelGameConditionInput
  ) {
    createGame(input: $input, condition: $condition) {
      id
      startedAt
      sideAPoints
      sideBPoints
    }
  }
`;

exports.createPlayerGames = /* GraphQL */ `
  mutation CreatePlayerGames(
    $input: CreatePlayerGamesInput!
    $condition: ModelPlayerGamesConditionInput
  ) {
    createPlayerGames(input: $input, condition: $condition) {
      id
    }
  }
`;

exports.updateGame = /* GraphQL */ `
  mutation UpdateGame(
    $input: UpdateGameInput!
    $condition: ModelGameConditionInput
  ) {
    updateGame(input: $input, condition: $condition) {
      id
      sideAPoints
      sideBPoints
      endedAt
      startedAt
    }
  }
`;
