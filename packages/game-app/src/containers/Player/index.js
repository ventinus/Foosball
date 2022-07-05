import { useParams } from "react-router-dom";
import { useQuery } from "react-query";
import CircularProgress from "@mui/material/CircularProgress";
import { Typography } from "@mui/material";

import { Breadcrumbs } from "@/components";
import { getPlayer } from "@/utils/api";

const Player = () => {
  const { playerId } = useParams();

  const { data = {}, isFetching } = useQuery(["player", playerId], () =>
    getPlayer(playerId)
  );
  const { alias, games = [] } = data;

  return (
    <div>
      <Breadcrumbs />
      {isFetching ? (
        <CircularProgress sx={{ display: "block", margin: "1rem auto 0" }} />
      ) : null}

      {alias ? (
        <Typography variant="h4" component="h2">
          {alias}
        </Typography>
      ) : null}

      {games.length ? (
        <Typography variant="body1">
          TODO: render games {JSON.stringify(games, null, 2)}
        </Typography>
      ) : null}
    </div>
  );
};

export default Player;
