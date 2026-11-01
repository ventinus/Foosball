import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { Link, RecordBar } from "@/components";
import { routes } from "@/utils/routes";
import { formatPct } from "@/utils/stats";
import { palette } from "@/utils/palette";

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

const Leaderboard = ({ rows }) => {
  if (!rows.length) {
    return <Typography variant="body1">No players yet</Typography>;
  }

  return (
    <TableContainer>
      <Table size="small" aria-label="Leaderboard">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 32 }}>#</TableCell>
            <TableCell>Player</TableCell>
            <TableCell align="right">Played</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
              W–L
            </TableCell>
            <TableCell sx={{ width: "30%", minWidth: 120 }}>Win rate</TableCell>
            <TableCell align="right" title="Goal difference">
              +/-
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={row.id} hover>
              <TableCell sx={{ color: "text.secondary" }}>
                {row.games ? i + 1 : "–"}
              </TableCell>
              <TableCell component="th" scope="row">
                <Link to={routes.player(row.id)}>{row.alias}</Link>
              </TableCell>
              <TableCell align="right">{row.games}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {row.wins}–{row.losses}
              </TableCell>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <RecordBar
                      height={6}
                      segments={[
                        { label: "Wins", value: row.wins, color: palette.win },
                        { label: "Losses", value: row.losses, color: palette.loss },
                      ]}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ minWidth: 36, textAlign: "right" }}
                  >
                    {formatPct(row.winRate)}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell align="right">{signed(row.goalDiff)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default Leaderboard;
