const soundBuzzer = require("./deviceHandlers/beep");

exports.formatTeams = (players) => {
  let team1, team2;
  const ids = players.map((player) => player.fobId);
  if (ids.length === 2) {
    team1 = `${ids[0]}`;
    team2 = `${ids[1]}`;
  } else if (ids.length === 4) {
    team1 = ids.slice(0, 2).sort().join("::");
    team2 = ids.slice(2, 4).sort().join("::");
  }
  return [team1, team2];
};

exports.toCompetitionId = (t1, t2) => [t1, t2].sort().join("V");

const prompt = (msg = []) => console.log(msg);

exports.prompt = prompt;

exports.showCompetition = (players) => {
  const aliases = players.map((player) => player.alias);

  if (!aliases.length) {
    prompt("Scan badge to start!");
    return;
  }

  prompt(aliases);
};

exports.minToMs = (min) => 1000 * 60 * min;

exports.beep = (forever) => soundBuzzer(undefined, forever);
