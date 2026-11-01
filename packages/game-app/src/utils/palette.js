// Validated chart palette (light surface). Wins/losses are a diverging pair
// (blue <-> red, gray midpoint); the two teams in a matchup are categorical
// slots 1 and 2.
export const palette = {
  win: "#2a78d6",
  loss: "#e34948",
  neutral: "#f0efec",
  teamA: "#2a78d6",
  teamB: "#eb6834",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
};

// Diverging fill for a record: blue the more the row player wins, red the
// more they lose, gray when even. Capped so dark text stays readable.
export const recordFill = ({ wins, losses }) => {
  const total = wins + losses;
  if (!total) return palette.neutral;
  const lean = (wins - losses) / total; // -1..1
  const pole = lean >= 0 ? palette.win : palette.loss;
  const amount = Math.round(Math.abs(lean) * 55);
  return `color-mix(in oklab, ${pole} ${amount}%, ${palette.neutral})`;
};
