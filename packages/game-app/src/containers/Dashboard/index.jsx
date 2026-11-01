import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Typography } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";

import {
  Breadcrumbs,
  HeadToHead,
  Leaderboard,
  ListGames,
  Section,
} from "@/components";
import { listAllPlayers, listFinishedGames } from "@/utils/api";
import { leaderboard } from "@/utils/stats";

const Dashboard = () => {
  const players = useQuery({
    queryKey: ["players", "all"],
    queryFn: () => listAllPlayers(),
  });
  const games = useQuery({
    queryKey: ["games", "finished"],
    queryFn: () => listFinishedGames(),
  });

  const rows = useMemo(
    () => leaderboard(players.data ?? [], games.data ?? []),
    [players.data, games.data]
  );
  const isLoading = players.isLoading || games.isLoading;
  const isError = players.isError || games.isError;

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Breadcrumbs />
      <Typography variant="h4" component="h1">
        Dashboard
      </Typography>

      <ListGames variant="active" />

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 7fr) minmax(0, 5fr)" },
          alignItems: "start",
        }}
      >
        <Section
          title="Leaderboard"
          subtitle={
            games.data
              ? `Across ${games.data.length} finished game${games.data.length === 1 ? "" : "s"}`
              : null
          }
        >
          {isLoading ? (
            <CircularProgress sx={{ display: "block", margin: "1rem auto" }} />
          ) : isError ? (
            <Typography variant="body1">Unable to load the leaderboard</Typography>
          ) : (
            <Leaderboard rows={rows} />
          )}
        </Section>
        <ListGames variant="recent" />
      </Box>

      {!isLoading && !isError ? (
        <HeadToHead players={rows} games={games.data ?? []} />
      ) : null}
    </Box>
  );
};

export default Dashboard;
