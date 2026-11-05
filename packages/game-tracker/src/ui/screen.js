// What the table's screen (the iPad page) should show for a game machine
// snapshot. Pure, so it can be tested off the Pi; src/server sends it to the
// page whenever it changes.

const {
  CONFIRM,
  DENY,
  UNDO_GOAL,
  SWAP_SIDES,
  ABANDON,
  REMATCH,
  MOVE_PLAYER,
  REMOVE_PLAYER,
  SET_ALIAS,
} = require("../state/actionTypes");
const lineup = require("../state/lineup");

// Events the screen may send to the machine. Anything else (badge scans,
// goals, the coin slot) only comes from the table's sensors.
const COMMANDS = [
  CONFIRM,
  DENY,
  UNDO_GOAL,
  SWAP_SIDES,
  ABANDON,
  REMATCH,
  MOVE_PLAYER,
  REMOVE_PLAYER,
  SET_ALIAS,
];
exports.COMMANDS = COMMANDS;

// A stand-in for each command, enough to ask the machine whether it would
// take it right now (guards such as "no goals yet" decide).
const probe = (type) => {
  switch (type) {
    case MOVE_PLAYER:
      return { type, id: null, side: 0, slot: 0 };
    case REMOVE_PLAYER:
      return { type, id: null };
    case SET_ALIAS:
      return { type, alias: "" };
    default:
      return { type };
  }
};

const screenOf = (snapshot) => {
  if (snapshot.matches("inactive")) {
    return lineup.playersOf(snapshot.context.sides).length ? "lineup" : "idle";
  }
  if (snapshot.matches("findPlayer")) return "searching";
  if (snapshot.matches("registration")) return "register";
  if (snapshot.matches("pending") || snapshot.matches("rematch")) return "starting";
  if (snapshot.matches("shouldResume")) return "resume";
  if (snapshot.matches("active")) return "playing";
  if (snapshot.matches("pauseWarning")) return "stillPlaying";
  if (snapshot.matches("complete")) return "final";
  return "idle";
};

// Screens with a countdown, which `deadline` is for.
const TIMED = new Set(["register", "stillPlaying", "final"]);

const SCORED = new Set(["resume", "playing", "stillPlaying", "final"]);

// Only what the page needs from each seated player.
const seat = (player) => (player ? { id: `${player.id}`, alias: player.alias ?? null } : null);

exports.screenView = (snapshot, status = {}) => {
  const { context } = snapshot;
  const screen = screenOf(snapshot);
  const game = SCORED.has(screen) ? context.currentGame : null;
  const score = game ? game.teamPoints : null;
  const final = screen === "final";

  return {
    screen,
    sides: context.sides.map((slots) => slots.map(seat)),
    canStart: screen === "lineup" && lineup.canStart(context.sides),
    full: lineup.isFull(context.sides),
    score,
    winner: final && score[0] !== score[1] ? (score[0] > score[1] ? 0 : 1) : null,
    // the finished game has been saved (the undo window is over)
    saved: final && snapshot.matches({ complete: "saved" }),
    deadline: TIMED.has(screen) ? context.deadline : null,
    newPlayer:
      screen === "register"
        ? { id: `${context.newPlayer.id}`, alias: context.newPlayer.alias }
        : null,
    // commands the machine would take right now
    actions: COMMANDS.filter((type) => snapshot.can(probe(type))),
    status,
  };
};
