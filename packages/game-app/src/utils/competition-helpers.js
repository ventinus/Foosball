import { reverse } from "lodash";

export const competitionIdToTeams = ({ competitionId, players, switched }) => {
  if (!competitionId || !players) return [];
  const teams = competitionId.split("V");
  const orderedTeams = switched ? reverse(teams) : teams;
  return orderedTeams.map((team) => {
    return team
      .split("::")
      .map((id) => players.find(({ playerID }) => id === playerID));
  });
};
