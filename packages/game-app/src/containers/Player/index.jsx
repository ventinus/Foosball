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
import Tooltip from "@mui/material/Tooltip";

import {
  Breadcrumbs,
  Link,
  PlayerLinks,
  PlayerRegistration,
  RecordBar,
  ResultBadge,
  Section,
  StatTile,
} from "@/components";
import { routes } from "@/utils/routes";
import { calculateDurationInMin } from "@/utils/time-helpers";
import { formatPct, playerSummary, winRate } from "@/utils/stats";
import { palette } from "@/utils/palette";
import { getPlayer } from "@/utils/api";

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const RecentForm = ({ form }) => (
  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
    {form.map(({ game, result, mine, theirs, opponents }) => (
      <Tooltip
        key={game.id}
        arrow
        title={`${mine.points}–${theirs.points} vs ${opponents
          .map((o) => o.alias)
          .join(" & ")} · ${new Date(game.startedAt).toDateString()}`}
      >
        <Link to={routes.game(game.id)} aria-label={`Game ${game.id}`}>
          <ResultBadge result={result} />
        </Link>
      </Tooltip>
    ))}
  </Box>
);

// Rivals or partners: one row per other player with the shared record.
const RelationshipTable = ({ rows, kind, emptyText }) => {
  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  return (
    <TableContainer>
      <Table size="small" aria-label={kind}>
        <TableHead>
          <TableRow>
            <TableCell>Player</TableCell>
            <TableCell align="right">Games</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
              W–L
            </TableCell>
            <TableCell sx={{ width: "35%", minWidth: 100 }}>Win rate</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell component="th" scope="row">
                <Link to={routes.player(row.id)}>{row.alias}</Link>
                {row.competitionId ? (
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{ ml: 1, whiteSpace: "nowrap" }}
                  >
                    <Link
                      to={routes.competition(row.competitionId)}
                      sx={{ color: "text.secondary" }}
                    >
                      1v1 history ›
                    </Link>
                  </Typography>
                ) : null}
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
                  <Typography variant="body2" sx={{ minWidth: 36, textAlign: "right" }}>
                    {formatPct(winRate(row))}
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const GameHistory = ({ history }) => {
  if (!history.length) {
    return (
      <Typography variant="body1">No games found, get out and play!</Typography>
    );
  }

  return (
    <TableContainer>
      <Table size="small" aria-label="Game history">
        <TableHead>
          <TableRow>
            <TableCell>Result</TableCell>
            <TableCell>Matchup</TableCell>
            <TableCell align="center">Score</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="right">Duration</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {history.map(({ game, result, mine, theirs, partners, opponents }) =>
            mine ? (
              <TableRow key={game.id} hover>
                <TableCell>
                  <ResultBadge result={result} />
                </TableCell>
                <TableCell component="th" scope="row">
                  {partners.length ? (
                    <>
                      with <PlayerLinks players={partners} />{" "}
                    </>
                  ) : null}
                  <Box component="span" sx={{ whiteSpace: "nowrap" }}>
                    vs <PlayerLinks players={opponents} />
                  </Box>
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{ ml: 1, whiteSpace: "nowrap" }}
                  >
                    <Link
                      to={routes.competition(game.competitionId)}
                      sx={{ color: "text.secondary" }}
                    >
                      matchup ›
                    </Link>
                  </Typography>
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
                >
                  <Link to={routes.game(game.id)}>
                    {mine.points} - {theirs.points}
                  </Link>
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Link to={routes.game(game.id)}>
                    {new Date(game.startedAt).toDateString()}
                  </Link>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  {!game.endedAt
                    ? "In-progress"
                    : calculateDurationInMin(game)}
                </TableCell>
              </TableRow>
            ) : null
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const Player = () => {
  const { playerId } = useParams();

  const { data, isFetching } = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => getPlayer(playerId),
  });

  const alias = data?.alias;
  const playerNotFound = !isFetching && !alias;
  const summary = useMemo(
    () =>
      playerSummary(
        playerId,
        (data?.games?.items ?? []).map(({ game }) => game).filter(Boolean)
      ),
    [playerId, data]
  );

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Breadcrumbs />
      {isFetching ? (
        <CircularProgress sx={{ display: "block", margin: "1rem auto 0" }} />
      ) : null}

      {alias ? (
        <>
          <Typography variant="h4" component="h1">
            {alias}
          </Typography>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                md: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            <StatTile
              label="Record"
              value={`${summary.wins}–${summary.losses}`}
              caption={plural(summary.played, "game")}
            />
            <StatTile label="Win rate" value={formatPct(summary.winRate)} />
            <StatTile
              label="Goal difference"
              value={signed(summary.goalDiff)}
              caption={`${summary.goalsFor} for · ${summary.goalsAgainst} against`}
            />
            <StatTile
              label="Streak"
              value={
                summary.streak.count
                  ? `${summary.streak.result}${summary.streak.count}`
                  : "–"
              }
              caption={
                summary.streak.count
                  ? `${summary.streak.count} ${
                      summary.streak.result === "W" ? "win" : "loss"
                    }${summary.streak.count === 1 ? "" : summary.streak.result === "W" ? "s" : "es"} in a row`
                  : null
              }
            />
          </Box>

          {summary.form.length ? (
            <Section title="Recent form" subtitle="Most recent first">
              <RecentForm form={summary.form} />
            </Section>
          ) : null}

          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              alignItems: "start",
            }}
          >
            <Section title="Rivals" subtitle={`${alias}'s record against each opponent`}>
              <RelationshipTable
                kind="Rivals"
                rows={summary.opponents}
                emptyText="No finished games yet"
              />
            </Section>
            <Section title="Partners" subtitle="Record when playing doubles together">
              <RelationshipTable
                kind="Partners"
                rows={summary.partners}
                emptyText="No doubles games yet"
              />
            </Section>
          </Box>

          <Section title="Game history">
            <GameHistory history={summary.history} />
          </Section>
        </>
      ) : null}

      {playerNotFound ? <PlayerRegistration /> : null}
    </Box>
  );
};

export default Player;
