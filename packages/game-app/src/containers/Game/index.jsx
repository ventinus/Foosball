import { useEffect, useMemo } from "react";
import { useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CircularProgress from "@mui/material/CircularProgress";
import { Box, Typography } from "@mui/material";

import {
  Breadcrumbs,
  Link,
  PlayerLinks,
  ResultBadge,
  Section,
  SeriesScoreboard,
} from "@/components";
import { getCompetitionGames, getGame, onUpdateGame } from "@/utils/api";
import { routes } from "@/utils/routes";
import { competitionSummary, gameSides } from "@/utils/stats";
import { calculateDurationInMin } from "@/utils/time-helpers";

const Side = ({ side, align }) => (
  <Box sx={{ textAlign: align, minWidth: 0 }}>
    <Typography
      variant="h1"
      component="p"
      sx={{
        fontWeight: side.won ? 700 : 400,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}
    >
      {side.points}
    </Typography>
    <Typography variant="h6" component="p" sx={{ mt: 1 }}>
      <PlayerLinks players={side.players} strong={side.won} />
    </Typography>
    {side.won ? (
      <Typography variant="overline" color="text.secondary">
        Winner
      </Typography>
    ) : null}
  </Box>
);

const Game = () => {
  const { gameId } = useParams();
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => getGame(gameId),
  });
  const competitionId = data?.competitionId;

  const competition = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: () => getCompetitionGames({ competitionId }),
    enabled: Boolean(competitionId),
  });
  const series = useMemo(
    () => competitionSummary(competitionId, competition.data?.items ?? []),
    [competitionId, competition.data]
  );

  const sides = data ? gameSides(data) : [];
  const live = data && !data.endedAt;

  useEffect(() => {
    const unsubscribe = onUpdateGame((updates) =>
      queryClient.setQueryData(["game", updates.id], (current) =>
        current ? { ...current, ...updates } : current
      )
    );
    return unsubscribe;
  }, [gameId, queryClient]);

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Breadcrumbs />
      {isFetching && !data ? (
        <CircularProgress sx={{ display: "block", margin: "1rem auto 0" }} />
      ) : null}

      {sides.length === 2 ? (
        <Section
          title={live ? "Live game" : "Final score"}
          subtitle={
            data.startedAt
              ? [
                  new Date(data.startedAt).toDateString(),
                  data.endedAt ? calculateDurationInMin(data) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null
          }
          action={live ? <ResultBadge result={null} /> : null}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
              alignItems: "start",
              gap: 2,
              py: 2,
            }}
          >
            <Side side={sides[0]} align="right" />
            <Typography
              variant="h3"
              component="span"
              color="text.secondary"
              sx={{ pt: 3 }}
            >
              vs
            </Typography>
            <Side side={sides[1]} align="left" />
          </Box>
        </Section>
      ) : null}

      {competitionId ? (
        <Section
          title="Head to head"
          subtitle="All games between these sides"
          action={
            <Link to={routes.competition(competitionId)}>
              View more games with this matchup
            </Link>
          }
        >
          {competition.isLoading ? (
            <CircularProgress sx={{ display: "block", margin: "0 auto" }} />
          ) : (
            <SeriesScoreboard summary={series} />
          )}
        </Section>
      ) : null}
    </Box>
  );
};

export default Game;
