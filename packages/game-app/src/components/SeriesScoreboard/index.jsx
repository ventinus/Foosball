import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { PlayerLinks, RecordBar } from "@/components";
import { palette } from "@/utils/palette";

const teamColors = [palette.teamA, palette.teamB];

const TeamHeader = ({ team, color, align }) => (
  <Box sx={{ textAlign: align, minWidth: 0 }}>
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        flexDirection: align === "right" ? "row-reverse" : "row",
      }}
    >
      <Box
        aria-hidden
        sx={{ width: 12, height: 12, borderRadius: "3px", bgcolor: color, flexShrink: 0 }}
      />
      <Typography variant="h6" component="span">
        <PlayerLinks players={team.players} />
      </Typography>
    </Box>
    <Typography
      variant="h2"
      component="p"
      sx={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
      aria-label={`${team.wins} wins`}
    >
      {team.wins}
    </Typography>
  </Box>
);

// Series record between the two teams of a matchup (`competitionSummary`).
const SeriesScoreboard = ({ summary }) => {
  const { teams, played, avgMargin } = summary;
  if (teams.length !== 2) return null;
  const [a, b] = teams;
  const leader =
    a.wins === b.wins ? null : a.wins > b.wins ? a : b;

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
          alignItems: "end",
          gap: 2,
        }}
      >
        <TeamHeader team={a} color={teamColors[0]} align="left" />
        <Typography variant="h5" color="text.secondary" sx={{ pb: 2 }}>
          wins
        </Typography>
        <TeamHeader team={b} color={teamColors[1]} align="right" />
      </Box>
      <RecordBar
        height={10}
        label={`Series: ${a.wins} to ${b.wins}`}
        segments={teams.map((team, i) => ({
          label: team.players.map((p) => p.alias).join(" & "),
          value: team.wins,
          color: teamColors[i],
        }))}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        {played
          ? [
              `${played} finished game${played === 1 ? "" : "s"}`,
              leader
                ? `${leader.players.map((p) => p.alias).join(" & ")} ${
                    leader.players.length === 1 ? "leads" : "lead"
                  } the series`
                : "Series tied",
              `Goals ${a.goals}–${b.goals}`,
              `Avg. margin ${avgMargin.toFixed(1)}`,
            ].join(" · ")
          : "No finished games yet"}
      </Typography>
    </Box>
  );
};

export default SeriesScoreboard;
