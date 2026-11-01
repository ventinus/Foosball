import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

const StatTile = ({ label, value, caption }) => (
  <Paper
    variant="outlined"
    role="group"
    aria-label={label}
    sx={{ p: 2, minWidth: 0 }}
  >
    <Typography variant="overline" color="text.secondary" component="p">
      {label}
    </Typography>
    <Typography variant="h4" component="p" sx={{ fontWeight: 500 }}>
      {value}
    </Typography>
    {caption ? (
      <Typography variant="body2" color="text.secondary">
        {caption}
      </Typography>
    ) : null}
  </Paper>
);

export default StatTile;
