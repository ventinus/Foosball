import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { Link, PlayerLinks } from "@/components";
import { routes } from "@/utils/routes";
import { gameSides } from "@/utils/stats";

const GameList = ({ games }) => {
  if (!games || !games.length) return null;

  return (
    <TableContainer>
      <Table size="small" aria-label="Games">
        <TableHead>
          <TableRow>
            <TableCell>Players</TableCell>
            <TableCell align="center">Score</TableCell>
            <TableCell align="right">
              {games[0].endedAt ? "Ended" : "Started"}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {games.map((game) => {
            const [a, b] = gameSides(game);
            if (!a || !b) return null;
            return (
              <TableRow key={game.id} hover>
                <TableCell component="th" scope="row">
                  <PlayerLinks players={a.players} strong={a.won} />
                  {" vs "}
                  <PlayerLinks players={b.players} strong={b.won} />
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
                >
                  <Link to={routes.game(game.id)}>
                    {a.points} - {b.points}
                  </Link>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Link to={routes.game(game.id)}>
                    {new Date(game.endedAt || game.startedAt).toDateString()}
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default GameList;
