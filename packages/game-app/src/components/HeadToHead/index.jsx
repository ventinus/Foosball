import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { Section } from "@/components";
import { routes } from "@/utils/routes";
import { headToHead, toCompetitionId } from "@/utils/stats";
import { palette, recordFill } from "@/utils/palette";

const cellSx = {
  p: 0,
  border: "2px solid",
  borderColor: "background.paper",
  minWidth: 52,
  height: 40,
  textAlign: "center",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
};

const Legend = () => (
  <Box
    sx={{
      display: "flex",
      flexWrap: "wrap",
      gap: 2,
      mt: 2,
      color: "text.secondary",
      fontSize: 13,
    }}
  >
    {[
      ["Row player leads", recordFill({ wins: 1, losses: 0 })],
      ["Even", recordFill({ wins: 1, losses: 1 })],
      ["Row player trails", recordFill({ wins: 0, losses: 1 })],
    ].map(([label, color]) => (
      <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box sx={{ width: 14, height: 14, borderRadius: "3px", bgcolor: color }} />
        {label}
      </Box>
    ))}
  </Box>
);

// Player × player grid: each cell is the row player's W–L against the column
// player. In 1v1 mode a cell opens that matchup's competition page.
const HeadToHead = ({ players, games }) => {
  const [mode, modeSet] = useState("singles");
  const navigate = useNavigate();
  const singlesOnly = mode === "singles";

  const grid = useMemo(
    () => headToHead(games, { singlesOnly }),
    [games, singlesOnly]
  );
  const ranked = players.filter(({ id }) => grid.players.has(id));

  const toggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={mode}
      onChange={(_, value) => value && modeSet(value)}
      aria-label="Games to include"
    >
      <ToggleButton value="singles">1 v 1</ToggleButton>
      <ToggleButton value="all">All games</ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Section
      title="Head to head"
      subtitle="Each cell is the row player's record against the column player"
      action={toggle}
    >
      {ranked.length < 2 ? (
        <Typography variant="body1">
          Not enough {singlesOnly ? "1 v 1 " : ""}games to compare players yet
        </Typography>
      ) : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              sx={{ borderCollapse: "collapse", fontFamily: "inherit" }}
            >
              <thead>
                <tr>
                  <Box component="th" sx={{ position: "sticky", left: 0, bgcolor: "background.paper" }} />
                  {ranked.map(({ id, alias }) => (
                    <Box
                      component="th"
                      key={id}
                      scope="col"
                      sx={{
                        fontWeight: 500,
                        fontSize: 13,
                        px: 0.5,
                        pb: 0.5,
                        maxWidth: 72,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "text.secondary",
                      }}
                      title={alias}
                    >
                      {alias}
                    </Box>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr key={row.id}>
                    <Box
                      component="th"
                      scope="row"
                      sx={{
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        bgcolor: "background.paper",
                        textAlign: "right",
                        fontWeight: 500,
                        fontSize: 13,
                        pr: 1.5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.alias}
                    </Box>
                    {ranked.map((col) => {
                      if (row.id === col.id) {
                        return (
                          <Box
                            component="td"
                            key={col.id}
                            aria-hidden
                            sx={{
                              ...cellSx,
                              bgcolor: "action.hover",
                              backgroundImage:
                                "repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.06) 4px 5px)",
                            }}
                          />
                        );
                      }
                      const cell = grid.get(row.id, col.id);
                      if (!cell) {
                        return (
                          <Box
                            component="td"
                            key={col.id}
                            sx={{ ...cellSx, color: "text.disabled" }}
                          >
                            ·
                          </Box>
                        );
                      }
                      const competitionId = toCompetitionId([row.id], [col.id]);
                      const summary = `${row.alias} vs ${col.alias}: ${cell.wins}–${cell.losses} in ${cell.games} game${cell.games === 1 ? "" : "s"}`;
                      return (
                        <Tooltip key={col.id} title={summary} arrow>
                          <Box
                            component="td"
                            aria-label={summary}
                            tabIndex={singlesOnly ? 0 : undefined}
                            role={singlesOnly ? "link" : undefined}
                            onClick={
                              singlesOnly
                                ? () => navigate(routes.competition(competitionId))
                                : undefined
                            }
                            onKeyDown={
                              singlesOnly
                                ? (e) =>
                                    e.key === "Enter" &&
                                    navigate(routes.competition(competitionId))
                                : undefined
                            }
                            sx={{
                              ...cellSx,
                              bgcolor: recordFill(cell),
                              color: palette.textPrimary,
                              cursor: singlesOnly ? "pointer" : "default",
                              "&:hover, &:focus-visible": {
                                outline: `2px solid ${palette.textPrimary}`,
                                outlineOffset: "-2px",
                              },
                            }}
                          >
                            {cell.wins}–{cell.losses}
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
          <Legend />
        </>
      )}
    </Section>
  );
};

export default HeadToHead;
