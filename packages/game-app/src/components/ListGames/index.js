import { Box } from "@mui/system";
import CircularProgress from "@mui/material/CircularProgress";
import { Button, Typography } from "@mui/material";
import { useQuery } from "react-query";
import upperFirst from "lodash/fp/upperFirst";

import { GameList } from "@/components";
import { listActiveGames, listRecentGames } from "@/utils/api";

const listGameApiMap = {
  active: listActiveGames,
  recent: listRecentGames,
};

const ListGames = ({ variant }) => {
  const {
    data = {},
    isLoading,
    error,
    isError,
  } = useQuery(["listGames", variant], listGameApiMap[variant]);
  const { games = [], nextToken } = data;
  console.log(games);

  return (
    <Box sx={{ p: "1rem" }}>
      <Typography variant="h3">{upperFirst(variant)} Games</Typography>
      {!isLoading && !isError && !games.length ? (
        <Typography variant="body1">No {variant} games</Typography>
      ) : null}

      {isError && !games.length ? (
        <Typography variant="body1">Unable to load {variant} games</Typography>
      ) : null}

      <GameList games={games} />

      {nextToken ? (
        <Button
          onClick={() => console.log("get more games", nextToken)}
          sx={{ display: "block", margin: "1rem auto 0" }}
        >
          Load more
        </Button>
      ) : null}

      {isLoading ? (
        <CircularProgress sx={{ display: "block", margin: "1rem auto 0" }} />
      ) : null}
    </Box>
  );
};

export default ListGames;
