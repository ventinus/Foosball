import { useEffect, Fragment, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "react-query";
import CircularProgress from "@mui/material/CircularProgress";
import { Box, Typography, Divider } from "@mui/material";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";

import { Breadcrumbs, Link } from "@/components";
import { getGame, onUpdateGame } from "@/utils/api";
import { routes } from "@/utils/routes";
import { competitionIdToTeams } from "@/utils/competition-helpers";

const Game = () => {
  const { gameId } = useParams();
  const queryClient = useQueryClient();

  const { data = {}, isFetching } = useQuery(["game", gameId], () =>
    getGame(gameId)
  );

  const updateGameData = useCallback(
    (updates) => queryClient.setQueryData(["game", gameId], updates),
    [gameId, queryClient]
  );

  const teams = competitionIdToTeams({
    competitionId: data.competitionId,
    players: data.players?.items,
    switched: data.switched,
  });

  useEffect(() => {
    const unsubscribe = onUpdateGame(gameId, updateGameData);
    // TODO: why does unsubscribe throw an error?
    // return unsubscribe;
  }, [gameId, updateGameData]);

  return (
    <div>
      <Breadcrumbs />
      {isFetching ? (
        <CircularProgress sx={{ display: "block", margin: "1rem auto 0" }} />
      ) : null}

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          mt: "2rem",
        }}
      >
        <Typography variant="h1" sx={{ pt: "4rem", pb: "4rem" }}>
          {data.sideAPoints}
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Typography variant="h1" sx={{ pt: "4rem", pb: "4rem" }}>
          {data.sideBPoints}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          mt: "2rem",
        }}
      >
        {teams.map((team, i) => (
          <Fragment key={i}>
            <List dense>
              {team.map(({ playerID, player: { alias } }) => (
                <ListItem key={playerID}>
                  <Link to={routes.player(playerID)}>
                    <ListItemText primary={alias} />
                  </Link>
                </ListItem>
              ))}
            </List>

            {i === 0 ? (
              <Typography variant="h3" component="span">
                VS
              </Typography>
            ) : null}
          </Fragment>
        ))}
      </Box>
      <Typography sx={{ textAlign: "center", mt: 4 }} variant="body1">
        <Link to={routes.competition(data.competitionId)}>
          View more games with this matchup
        </Link>
      </Typography>
    </div>
  );
};

export default Game;
