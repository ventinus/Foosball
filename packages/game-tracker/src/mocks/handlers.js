const { graphql, HttpResponse } = require("msw");

const respond = (data) => HttpResponse.json({ data });

exports.handlers = [
  graphql.query("GetPlayer", ({ variables }) => {
    switch (variables.fobId) {
      case "12345":
        return respond({ getPlayer: { fobId: "12345", alias: "player-exists" } });
      default:
        return respond({ getPlayer: null });
    }
  }),
  graphql.query("GameByCompetition", ({ variables }) => {
    switch (variables.competitionId) {
      case "1::2V3::4":
        return respond({
          gameByCompetition: {
            items: [{ id: "game-id", sideAPoints: 4, sideBPoints: 3 }],
          },
        });
      default:
        return respond({ gameByCompetition: { items: [] } });
    }
  }),
  graphql.mutation("CreatePlayer", ({ variables }) =>
    respond({ createPlayer: variables.input })
  ),
  graphql.mutation("CreateGame", () =>
    respond({
      createGame: { id: "new-game-id", sideAPoints: 0, sideBPoints: 0 },
    })
  ),
  graphql.mutation("CreatePlayerGames", () =>
    respond({ createPlayerGames: { id: "player-game-id" } })
  ),
  graphql.mutation("UpdateGame", () => respond({ updateGame: null })),
];
