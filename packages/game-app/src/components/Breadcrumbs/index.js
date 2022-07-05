import { useParams } from "react-router-dom";
import Typography from "@mui/material/Typography";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";

import { Link } from "@/components";
import { routes } from "@/utils/routes";

const Breadcrumbs = () => {
  const { gameId, playerId, competitionId } = useParams();
  return (
    <MuiBreadcrumbs separator="›" aria-label="breadcrumb">
      <Link to={routes.dashboard()}>Dashboard</Link>
      {gameId ? <Typography color="text.primary">Game</Typography> : null}
      {playerId ? <Typography color="text.primary">Player</Typography> : null}
      {competitionId ? (
        <Typography color="text.primary">Competition</Typography>
      ) : null}
    </MuiBreadcrumbs>
  );
};

export default Breadcrumbs;
