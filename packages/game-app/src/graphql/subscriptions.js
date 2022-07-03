/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreatePlayer = /* GraphQL */ `
  subscription OnCreatePlayer {
    onCreatePlayer {
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
export const onUpdatePlayer = /* GraphQL */ `
  subscription OnUpdatePlayer {
    onUpdatePlayer {
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
export const onDeletePlayer = /* GraphQL */ `
  subscription OnDeletePlayer {
    onDeletePlayer {
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
export const onCreateGame = /* GraphQL */ `
  subscription OnCreateGame {
    onCreateGame {
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
export const onDeleteGame = /* GraphQL */ `
  subscription OnDeleteGame {
    onDeleteGame {
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
export const onCreatePlayerGames = /* GraphQL */ `
  subscription OnCreatePlayerGames {
    onCreatePlayerGames {
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
export const onUpdatePlayerGames = /* GraphQL */ `
  subscription OnUpdatePlayerGames {
    onUpdatePlayerGames {
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
export const onDeletePlayerGames = /* GraphQL */ `
  subscription OnDeletePlayerGames {
    onDeletePlayerGames {
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
