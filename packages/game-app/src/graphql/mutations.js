/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createPlayer = /* GraphQL */ `
  mutation CreatePlayer(
    $input: CreatePlayerInput!
    $condition: ModelPlayerConditionInput
  ) {
    createPlayer(input: $input, condition: $condition) {
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
export const updatePlayer = /* GraphQL */ `
  mutation UpdatePlayer(
    $input: UpdatePlayerInput!
    $condition: ModelPlayerConditionInput
  ) {
    updatePlayer(input: $input, condition: $condition) {
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
export const deletePlayer = /* GraphQL */ `
  mutation DeletePlayer(
    $input: DeletePlayerInput!
    $condition: ModelPlayerConditionInput
  ) {
    deletePlayer(input: $input, condition: $condition) {
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
export const createGame = /* GraphQL */ `
  mutation CreateGame(
    $input: CreateGameInput!
    $condition: ModelGameConditionInput
  ) {
    createGame(input: $input, condition: $condition) {
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
export const updateGame = /* GraphQL */ `
  mutation UpdateGame(
    $input: UpdateGameInput!
    $condition: ModelGameConditionInput
  ) {
    updateGame(input: $input, condition: $condition) {
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
export const deleteGame = /* GraphQL */ `
  mutation DeleteGame(
    $input: DeleteGameInput!
    $condition: ModelGameConditionInput
  ) {
    deleteGame(input: $input, condition: $condition) {
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
export const createPlayerGames = /* GraphQL */ `
  mutation CreatePlayerGames(
    $input: CreatePlayerGamesInput!
    $condition: ModelPlayerGamesConditionInput
  ) {
    createPlayerGames(input: $input, condition: $condition) {
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
export const updatePlayerGames = /* GraphQL */ `
  mutation UpdatePlayerGames(
    $input: UpdatePlayerGamesInput!
    $condition: ModelPlayerGamesConditionInput
  ) {
    updatePlayerGames(input: $input, condition: $condition) {
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
export const deletePlayerGames = /* GraphQL */ `
  mutation DeletePlayerGames(
    $input: DeletePlayerGamesInput!
    $condition: ModelPlayerGamesConditionInput
  ) {
    deletePlayerGames(input: $input, condition: $condition) {
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
