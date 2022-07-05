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

import { Breadcrumbs, Link } from "@/components";
import { getCompetitionGames } from "@/utils/api";
import { routes } from "@/utils/routes";
import { competitionIdToTeams } from "@/utils/competition-helpers";

const calculateDurationInMin = ({ startedAt, endedAt }) => {
  const diff = new Date(endedAt) - new Date(startedAt);
  const duration = Math.floor(diff / 60000);
  return `${duration} minute${duration > 1 ? "s" : ""}`;
};

const Competition = () => {
  const { competitionId } = useParams();

  const { data = {}, isFetching } = useQuery(
    ["competition", competitionId],
    () => getCompetitionGames({ competitionId })
  );
  const games = data.items || [];
  const teams = competitionIdToTeams({
    competitionId,
    players: _get(games, "[0].players.items"),
    switched: false,
  })
    .map((team) => team.map((pl) => pl.player.alias).join(" "))
    .join(" VS ");

  return (
    <div>
      <Breadcrumbs />
      {isFetching ? (
        <CircularProgress sx={{ display: "block", margin: "1rem auto 0" }} />
      ) : null}

      <Typography variant="h2">Games for {teams}</Typography>

      {!isFetching && !games.length ? (
        <Typography variant="body1">
          Could not find games for this competition
        </Typography>
      ) : null}

      {!isFetching && games.length ? (
        <TableContainer>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
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
                  return (
                    <TableRow
                      key={id}
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
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
      ) : null}
    </div>
  );
};

export default Competition;
