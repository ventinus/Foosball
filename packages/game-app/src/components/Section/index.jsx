import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

// Titled card used to group each block of a page.
const Section = ({ title, subtitle, action, children, sx }) => (
  <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0, ...sx }}>
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1,
        mb: 2,
      }}
    >
      <Box>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action}
    </Box>
    {children}
  </Paper>
);

export default Section;
