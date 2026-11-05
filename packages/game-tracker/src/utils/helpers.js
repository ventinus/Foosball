const soundBuzzer = require("./deviceHandlers/beep");
const {
  APPEND_CHAR,
  BACKSPACE,
  CONFIRM,
  DENY,
  INITIATE_GAME,
  SCORE_POINT,
} = require("../state/actionTypes");

exports.toCompetitionId = (t1, t2) => [t1, t2].sort().join("V");

// A competitionId lists its teams in sorted order, so a game's `switched` flag
// records which end each team played: true when the competition's second team
// was on side A.
exports.isSwitched = (sideA, sideB) => sideA > sideB;

// The [sideA, sideB] teams of a saved game, from its competitionId and `switched`.
exports.sideTeams = (competitionId, switched) => {
  const teams = competitionId.split("V");
  return switched ? teams.reverse() : teams;
};

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

// Maps a message from the break-beam process (scorePoint.js) to a machine
// event, or null to ignore it. Sensors 0/1 are the side A/B goals and higher
// ones start a game; anything that isn't a sensor index (such as an
// `{ error }` report) is ignored.
exports.breakBeamEvent = (message) => {
  if (!Number.isInteger(message) || message < 0) return null;
  return message <= 1
    ? { type: SCORE_POINT, index: message }
    : { type: INITIATE_GAME };
};
