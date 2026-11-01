import Box from "@mui/material/Box";

// A thin bar split into proportional segments, e.g. wins vs losses or one
// team's wins vs the other's. Segments are separated by a 2px gap.
const RecordBar = ({ segments, height = 8, label }) => {
  const total = segments.reduce((sum, { value }) => sum + value, 0);
  if (!total) {
    return (
      <Box
        role="img"
        aria-label={label ?? "No results"}
        sx={{ height, borderRadius: "4px", bgcolor: "action.hover" }}
      />
    );
  }
  const visible = segments.filter(({ value }) => value > 0);
  return (
    <Box
      role="img"
      aria-label={label ?? segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
      sx={{ display: "flex", gap: "2px", height, width: "100%" }}
    >
      {visible.map(({ value, color, label: segmentLabel }, i) => (
        <Box
          key={segmentLabel}
          title={`${segmentLabel}: ${value}`}
          sx={{
            flex: `${value} 1 0`,
            bgcolor: color,
            borderTopLeftRadius: i === 0 ? 4 : 0,
            borderBottomLeftRadius: i === 0 ? 4 : 0,
            borderTopRightRadius: i === visible.length - 1 ? 4 : 0,
            borderBottomRightRadius: i === visible.length - 1 ? 4 : 0,
          }}
        />
      ))}
    </Box>
  );
};

export default RecordBar;
