export const getPlayer = /* GraphQL */ `
  query GetPlayer($fobId: ID!) {
    getPlayer(fobId: $fobId) {
      fobId
      alias
      games {
        items {
          game {
            competitionId
            id
            players {
              items {
                playerID
                player {
                  alias
                }
              }
            }
            endedAt
            sideAPoints
            sideBPoints
            startedAt
            switched
          }
        }
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
      players {
        items {
          id
          playerID
          gameID
          createdAt
          updatedAt
          player {
            alias
          }
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
          items {
            playerID
            player {
              alias
            }
          }
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
        players {
          items {
            playerID
            player {
              alias
            }
          }
        }
      }
      nextToken
    }
  }
`;

export const createPlayer = /* GraphQL */ `
  mutation CreatePlayer(
    $input: CreatePlayerInput!
    $condition: ModelPlayerConditionInput
  ) {
    createPlayer(input: $input, condition: $condition) {
      fobId
      alias
      games {
        items {
          game {
            competitionId
            id
            players {
              items {
                player {
                  alias
                  fobId
                }
              }
            }
            endedAt
            sideAPoints
            sideBPoints
            startedAt
            switched
          }
        }
      }
    }
  }
`;


export const onUpdateGame = /* GraphQL */ `
  subscription OnUpdateGame {
    onUpdateGame {
      id
      switched
      sideAPoints
      sideBPoints
      startedAt
      endedAt
      competitionId
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
