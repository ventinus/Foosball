const soundBuzzer = require("./deviceHandlers/beep");
const {
  APPEND_CHAR,
  BACKSPACE,
  CONFIRM,
  DENY,
} = require("../state/actionTypes");

// How many players (in scan order) make up team 1, by total player count.
// With 3 players the first two scanned are a team and the third plays alone,
// so a fourth scan joins the third player and the game becomes 2v2.
const TEAM_ONE_SIZE = { 2: 1, 3: 2, 4: 2 };

exports.isValidPlayerCount = (count) => count in TEAM_ONE_SIZE;

exports.formatTeams = (players) => {
  const ids = players.map((player) => `${player.id}`);
  const size = TEAM_ONE_SIZE[ids.length];
  if (!size) return [undefined, undefined];
  const toTeam = (teamIds) => teamIds.sort().join("::");
  return [toTeam(ids.slice(0, size)), toTeam(ids.slice(size))];
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

// Maps a key pressed while typing an alias to a machine event, or null to
// ignore it. readline leaves the key name undefined for punctuation such as
// "-" and ".".
exports.registrationKeyEvent = (keyName) => {
  if (!keyName) return null;
  if (keyName.length === 1 && /[a-z0-9]/.test(keyName)) {
    return { type: APPEND_CHAR, character: keyName };
  }
  switch (keyName) {
    case "return":
      return { type: CONFIRM };
    case "backspace":
      return { type: BACKSPACE };
    case "escape":
      return { type: DENY };
    default:
      return null;
  }
};
