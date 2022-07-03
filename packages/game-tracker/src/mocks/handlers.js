const { graphql } = require("msw");

exports.handlers = [
  graphql.query("GetPlayer", (req, res, ctx) => {
    let data;
    switch (req.body.variables.fobId) {
      case "12345":
        data = { id: "12345", alias: "player-exists" };
        break;
      default:
        data = null;
        break;
    }
    return res(ctx.data({ getPlayer: data }));
  }),
  graphql.query("GameByCompetition", (req, res, ctx) => {
    let data;
    switch (req.body.variables.competitionId) {
      case "1::2V3::4":
        data = {
          items: [{ id: "game-id", sideAPoints: 4, sideBPoints: 3 }],
        };
        break;
      default:
        data = null;
        break;
    }
    return res(
      ctx.data({
        gameByCompetition: data,
      })
    );
  }),
  graphql.mutation("CreatePlayer", (req, res, ctx) => {
    return res(ctx.data({ createPlayer: req.body.variables.input }));
  }),
  graphql.mutation("CreateGame", (req, res, ctx) => {
    return res(
      ctx.data({
        createGame: { id: "new-game-id", sideAPoints: 0, sideBPoints: 0 },
      })
    );
  }),
  graphql.mutation("CreatePlayerGames", (req, res, ctx) => {
    return res(ctx.data({ createPlayerGames: "success" }));
  }),
  graphql.mutation("UpdateGame", (req, res, ctx) => {
    return res(ctx.data({ updateGame: null }));
  }),
];
