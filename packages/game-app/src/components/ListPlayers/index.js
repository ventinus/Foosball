import { Box } from "@mui/system";
import CircularProgress from "@mui/material/CircularProgress";
import { Button, ListItemButton, Typography } from "@mui/material";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import { useQuery } from "react-query";

import { Link } from "@/components";
import { listPlayers } from "@/utils/api";
import { routes } from "@/utils/routes";

const ListPlayers = () => {
  const {
    data = {},
    isLoading,
    error,
    isError,
  } = useQuery("listPlayers", listPlayers);

  const { players = [], nextToken } = data;

  return (
    <Box sx={{ p: "1rem" }}>
      <Typography variant="h3">Players</Typography>
      {!isLoading && !isError && !players.length ? (
        <Typography variant="body1">No players</Typography>
      ) : null}

      {isError && !players.length ? (
        <Typography variant="body1">Unable to load players</Typography>
      ) : null}

      {players.length ? (
        <List dense>
          {players.map(({ fobId, alias }) => (
            <ListItem key={fobId}>
              <Link to={routes.player(fobId)}>
                <ListItemText primary={alias} />
              </Link>
            </ListItem>
          ))}
        </List>
      ) : null}

      {nextToken ? (
        <Button
          onClick={() => console.log("get more players", nextToken)}
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

export default ListPlayers;
