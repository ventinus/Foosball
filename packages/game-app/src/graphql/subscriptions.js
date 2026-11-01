/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreatePlayer = /* GraphQL */ `
  subscription OnCreatePlayer($filter: ModelSubscriptionPlayerFilterInput) {
    onCreatePlayer(filter: $filter) {
      fobId
      alias
      type
      games {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdatePlayer = /* GraphQL */ `
  subscription OnUpdatePlayer($filter: ModelSubscriptionPlayerFilterInput) {
    onUpdatePlayer(filter: $filter) {
      fobId
      alias
      type
      games {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeletePlayer = /* GraphQL */ `
  subscription OnDeletePlayer($filter: ModelSubscriptionPlayerFilterInput) {
    onDeletePlayer(filter: $filter) {
      fobId
      alias
      type
      games {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateGame = /* GraphQL */ `
  subscription OnCreateGame($filter: ModelSubscriptionGameFilterInput) {
    onCreateGame(filter: $filter) {
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateGame = /* GraphQL */ `
  subscription OnUpdateGame($filter: ModelSubscriptionGameFilterInput) {
    onUpdateGame(filter: $filter) {
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteGame = /* GraphQL */ `
  subscription OnDeleteGame($filter: ModelSubscriptionGameFilterInput) {
    onDeleteGame(filter: $filter) {
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreatePlayerGames = /* GraphQL */ `
  subscription OnCreatePlayerGames(
    $filter: ModelSubscriptionPlayerGamesFilterInput
  ) {
    onCreatePlayerGames(filter: $filter) {
      id
      playerID
      gameID
      player {
        fobId
        alias
        type
        createdAt
        updatedAt
        __typename
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdatePlayerGames = /* GraphQL */ `
  subscription OnUpdatePlayerGames(
    $filter: ModelSubscriptionPlayerGamesFilterInput
  ) {
    onUpdatePlayerGames(filter: $filter) {
      id
      playerID
      gameID
      player {
        fobId
        alias
        type
        createdAt
        updatedAt
        __typename
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeletePlayerGames = /* GraphQL */ `
  subscription OnDeletePlayerGames(
    $filter: ModelSubscriptionPlayerGamesFilterInput
  ) {
    onDeletePlayerGames(filter: $filter) {
      id
      playerID
      gameID
      player {
        fobId
        alias
        type
        createdAt
        updatedAt
        __typename
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
