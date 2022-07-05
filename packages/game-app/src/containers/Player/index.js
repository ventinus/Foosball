import { useParams } from "react-router-dom";
import { useQuery } from "react-query";
import CircularProgress from "@mui/material/CircularProgress";
import { Typography } from "@mui/material";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import _get from "lodash/get";

import { Breadcrumbs, PlayerRegistration, Link } from "@/components";
import { routes } from "@/utils/routes";
import { calculateDurationInMin } from "@/utils/time-helpers";
import { competitionIdToTeams } from "@/utils/competition-helpers";
import { getPlayer } from "@/utils/api";

const PlayerGames = ({ games }) => {
  if (!games.length) {
    return (
      <Typography variant="body1">No games found, get out and play!</Typography>
    );
  }

  return (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Matchup</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Score</TableCell>
            <TableCell align="right">Duration</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {games.map(
            ({
              id,
              competitionId,
              switched,
              sideAPoints,
              sideBPoints,
              startedAt,
              endedAt,
              players,
            }) => {
              const points = [sideAPoints, sideBPoints];
              const teams = competitionIdToTeams({
                competitionId,
                switched,
                players: players.items,
              })
                .map((team) => team.map((pl) => pl.player.alias).join(" "))
                .join(" VS ");
              return (
                <TableRow
                  key={id}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    <Link to={routes.game(id)}>{teams}</Link>
                  </TableCell>
                  <TableCell>
                    <Link to={routes.game(id)}>
                      {new Date(startedAt).toDateString()}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {(switched ? points.reverse() : points).join(" - ")}
                  </TableCell>
                  <TableCell align="right">
                    {!endedAt
                      ? "In-progress"
                      : calculateDurationInMin({ startedAt, endedAt })}
                  </TableCell>
                </TableRow>
              );
            }
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const Player = () => {
  const { playerId } = useParams();

  const { data, isFetching } = useQuery(["player", playerId], () =>
    getPlayer(playerId)
  );

  const games = _get(data, "games.items", []);
  const alias = _get(data, "alias");
  const playerNotFound = !isFetching && !alias;

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

      {!playerNotFound ? (
        <PlayerGames games={games.map((g) => g.game)} />
      ) : null}

      {playerNotFound ? <PlayerRegistration /> : null}
    </div>
  );
};

export default Player;
