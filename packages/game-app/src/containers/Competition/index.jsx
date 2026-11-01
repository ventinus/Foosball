import { useMemo } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import CircularProgress from "@mui/material/CircularProgress";
import { Box, Typography } from "@mui/material";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import {
  Breadcrumbs,
  Link,
  PlayerLinks,
  ResultBadge,
  Section,
  SeriesScoreboard,
} from "@/components";
import { getCompetitionGames } from "@/utils/api";
import { routes } from "@/utils/routes";
import { competitionSides, competitionSummary } from "@/utils/stats";
import { calculateDurationInMin } from "@/utils/time-helpers";

const teamName = (team) => team.players.map((p) => p.alias).join(" & ");

const Competition = () => {
  const { competitionId } = useParams();

  const { data, isFetching } = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: () => getCompetitionGames({ competitionId }),
  });
  const summary = useMemo(
    () => competitionSummary(competitionId, data?.items ?? []),
    [competitionId, data]
  );
  const [teamA, teamB] = summary.teams;
  const hasGames = summary.games.length > 0;

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Breadcrumbs />
      {isFetching ? (
        <CircularProgress sx={{ display: "block", margin: "1rem auto 0" }} />
      ) : null}

      {hasGames ? (
        <Typography variant="h4" component="h1">
          <PlayerLinks players={teamA.players} /> vs{" "}
          <PlayerLinks players={teamB.players} />
        </Typography>
      ) : null}

      {!isFetching && !hasGames ? (
        <Typography variant="body1">
          Could not find games for this competition
        </Typography>
      ) : null}

      {hasGames ? (
        <>
          <Section title="Series">
            <SeriesScoreboard summary={summary} />
          </Section>

          <Section title="Games">
            <TableContainer>
              <Table size="small" aria-label="Games in this matchup">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">{teamName(teamA)}</TableCell>
                    <TableCell align="center">{teamName(teamB)}</TableCell>
                    <TableCell>Winner</TableCell>
                    <TableCell align="right">Duration</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.games.map((game) => {
                    const sides = competitionSides(game);
                    const winner = sides.find((side) => side.won);
                    return (
                      <TableRow key={game.id} hover>
                        <TableCell component="th" scope="row" sx={{ whiteSpace: "nowrap" }}>
                          <Link to={routes.game(game.id)}>
                            {new Date(game.startedAt).toDateString()}
                          </Link>
                        </TableCell>
                        {sides.map((side, i) => (
                          <TableCell
                            key={i}
                            align="center"
                            sx={{
                              fontWeight: side.won ? 700 : 400,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {side.points}
                          </TableCell>
                        ))}
                        <TableCell>
                          {!game.endedAt ? (
                            <ResultBadge result={null} />
                          ) : winner ? (
                            teamName(winner)
                          ) : (
                            "Tie"
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {!game.endedAt
                            ? "In-progress"
                            : calculateDurationInMin(game)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>
        </>
      ) : null}
    </Box>
  );
};

export default Competition;
