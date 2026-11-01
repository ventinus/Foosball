import Box from "@mui/material/Box";

import { palette } from "@/utils/palette";

const styles = {
  W: { bgcolor: palette.win, color: "#fff", label: "Win" },
  L: { bgcolor: palette.loss, color: "#fff", label: "Loss" },
  T: { bgcolor: palette.neutral, color: palette.textPrimary, label: "Tie" },
  live: { bgcolor: "transparent", color: palette.win, label: "Live" },
};

// A small lettered square (W / L / T), or a "Live" tag for unfinished games.
// The letter carries the meaning so it never relies on color alone.
const ResultBadge = ({ result }) => {
  const key = result ?? "live";
  const { label, ...sx } = styles[key];
  return (
    <Box
      component="span"
      aria-label={label}
      title={label}
      sx={{
        ...sx,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 24,
        height: 24,
        px: key === "live" ? 0.75 : 0,
        borderRadius: "4px",
        border: key === "live" ? `1px solid ${palette.win}` : "none",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {key === "live" ? "LIVE" : key}
    </Box>
  );
};

export default ResultBadge;
