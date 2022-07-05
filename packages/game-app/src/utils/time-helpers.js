export const calculateDurationInMin = ({ startedAt, endedAt }) => {
  const diff = new Date(endedAt) - new Date(startedAt);
  const duration = Math.floor(diff / 60000);
  return `${duration} minute${duration > 1 ? "s" : ""}`;
};
