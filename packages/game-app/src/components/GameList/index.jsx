import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { Link } from "@/components";
import { routes } from "@/utils/routes";
import { competitionIdToTeams } from "@/utils/competition-helpers";

const GameList = ({ games }) => {
  if (!games || !games.length) return null;

  return (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Players</TableCell>
            <TableCell>Score</TableCell>
            <TableCell align="right">
              {games[0].endedAt ? "End" : "Start"} Date
            </TableCell>
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
            }) => (
              <TableRow
                key={id}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <Link to={routes.game(id)}>
                    {competitionIdToTeams({
                      competitionId,
                      switched,
                      players: players.items,
                    })
                      .map((team) =>
                        team.map((player) => player.player.alias).join(" ")
                      )
                      .join(" VS ")}
                  </Link>
                </TableCell>
                <TableCell>{`${sideAPoints} - ${sideBPoints}`}</TableCell>
                <TableCell align="right">
                  {new Date(endedAt || startedAt).toDateString()}
                </TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default GameList;
