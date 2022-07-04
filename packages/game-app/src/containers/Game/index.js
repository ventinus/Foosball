import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "react-query";
import CircularProgress from "@mui/material/CircularProgress";
import { Box, Typography, Divider } from "@mui/material";

import { Breadcrumbs } from "@/components";
import { getGame, onUpdateGame } from "@/utils/api";

const Game = () => {
  const { gameId } = useParams();
  const queryClient = useQueryClient();

  const { data = {}, isFetching } = useQuery(["game", gameId], () =>
    getGame(gameId)
  );
  const { competitionId, sideAPoints, sideBPoints } = data;
  const updateGameData = (updates) =>
    queryClient.setQueryData(["game", gameId], { ...data, ...updates });

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

      <Typography variant="h4" component="h2" textAlign="center">
        {competitionId}
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          mt: "2rem",
        }}
      >
        <Typography variant="h1" sx={{ pt: "4rem", pb: "4rem" }}>
          {sideAPoints}
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Typography variant="h1" sx={{ pt: "4rem", pb: "4rem" }}>
          {sideBPoints}
        </Typography>
      </Box>
    </div>
  );
};

export default Game;
