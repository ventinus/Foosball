import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";

import { Link } from "@/components";
import { routes } from "@/utils/routes";

const GameList = ({ games }) => {
  if (!games || !games.length) return null;

  return (
    <List dense>
      {games.map(
        ({ id, competitionId, switched, sideAPoints, sideBPoints, startedAt }) => (
          <ListItem key={id}>
            <Link to={routes.game(id)}>
              <ListItemText
                primary={`${competitionId} - ${startedAt}`}
                secondary={`${sideAPoints} - ${sideBPoints}`}
              />
            </Link>
          </ListItem>
        )
      )}
    </List>
  );
};

export default GameList;
