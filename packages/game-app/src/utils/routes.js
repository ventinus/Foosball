export const routes = {
  dashboard: () => "/",
  game: (gameId) => `/games/${gameId}`,
  player: (playerId) => `/players/${playerId}`,
};
