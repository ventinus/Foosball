const { createActor } = require("xstate");
const readline = require("readline");
const debounce = require("lodash/debounce");
const throttle = require("lodash/throttle");
const { Amplify } = require("aws-amplify");

// `amplify pull` writes aws-exports.js as an ES module (`export default`); Node 24's
// require(esm) returns its namespace, so unwrap `default` when present.
const awsExports = require("./aws-exports");
const awsconfig = awsExports.default ?? awsExports;

const { gameMachine } = require("./state/config");
const {
  BADGE_SCAN,
  CONFIRM,
  PAUSE,
  GAME_ACTIVITY,
  WARN_PAUSE,
  DENY,
} = require("./state/actionTypes");
const {
  childProcess,
  minToMs,
  registrationKeyEvent,
  breakBeamEvent,
} = require("./utils");
const { scoreboardView } = require("./utils/scoreboard/view");
const sync = require("./sync");

Amplify.configure(awsconfig);

// Players and games are saved locally first and sent to the API when it's
// reachable, so the table keeps working offline.
sync.init({ dataDir: sync.DEFAULT_DATA_DIR });
sync.refreshPlayers();

// The LED matrix scoreboard wired to this Pi.
const scoreboardChild = childProcess(
  "scoreboard.js",
  (message) => console.log("scoreboard", message),
  (err) => console.log("onScoreboardError", err),
  // a restarted scoreboard starts blank; show it the current view
  { onRestart: () => resendScoreboard() }
);

// Sends the scoreboard what to show, only when it changes.
let lastScoreboardView;
const updateScoreboard = (snapshot) => {
  const view = scoreboardView(snapshot);
  const key = JSON.stringify(view);
  if (key === lastScoreboardView || !scoreboardChild.connected) return;
  lastScoreboardView = key;
  scoreboardChild.send({ view });
};

const resendScoreboard = () => {
  lastScoreboardView = undefined;
  updateScoreboard(gameService.getSnapshot());
};

const gameService = createActor(gameMachine);
let currentState;
gameService.subscribe((snapshot) => {
  currentState = snapshot.value;
  updateScoreboard(snapshot);
});
gameService.start();

const onBadgeScan = ({ message, id }) => {
  if (message) {
    console.log("FROM SCAN", message);
  } else if (id) {
    // normalize to match the string fobIds the API returns
    gameService.send({ type: BADGE_SCAN, id: String(id) });
  }
};

const onBreakBeam = (message) => {
  console.log("break beam", message);
  const event = breakBeamEvent(message);
  if (event) gameService.send(event);
  else if (message?.error) console.log("onBreakBeamError", message.error);
};
const onAppKeypress = (keyName) => {
  switch (keyName) {
    case "y":
    case "return":
      gameService.send({ type: CONFIRM });
      break;
    case "n":
      gameService.send({ type: DENY });
      break;
  }
};

const onInputKeypress = (keyName) => {
  const event = registrationKeyEvent(keyName);
  if (event) gameService.send(event);
};

const INACTIVITY_WARN_MS = minToMs(2); // no vibration for this long → warn
const PAUSE_GRACE_MS = minToMs(1); // time to respond to the warning before the game resets

let gameWarnId = 0;
let gamePauseId = 0;
const onVibration = () => {
  clearTimeout(gameWarnId);
  clearTimeout(gamePauseId);

  if (currentState === "pauseWarning") gameService.send({ type: GAME_ACTIVITY });

  gameWarnId = setTimeout(() => {
    gameService.send({ type: WARN_PAUSE });
    gamePauseId = setTimeout(
      () => gameService.send({ type: PAUSE }),
      PAUSE_GRACE_MS
    );
  }, INACTIVITY_WARN_MS);
};

const onBadgeScanError = (err) => console.log("onBadgeScanError", err);
const onGameStartError = (err) => console.log("onGameStartError", err);
const onBreakBeamError = (err) => console.log("onBreakBeamError", err);

const debounceOptions = { leading: true, trailing: false };
const badgeScanChild = childProcess(
  "readCard.js",
  debounce(onBadgeScan, 2000, debounceOptions),
  onBadgeScanError
);
// const gameStartChild = childProcess('gameStart.js', onGameStart, onGameStartError)
const scorePointChild = childProcess(
  "scorePoint.js",
  onBreakBeam,
  onBreakBeamError
);
// throttle (not debounce): continuous vibration must keep resetting the inactivity timer
const vibrationChild = childProcess(
  "vibration.js",
  throttle(onVibration, 300, debounceOptions)
);

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

// Debounce only the y/n/return app keys (guards against double-confirming);
// alias typing during registration must not drop fast keystrokes.
const debouncedAppKeypress = debounce(onAppKeypress, 300, debounceOptions);

// Stops the sensor processes so they release their GPIO pins; the scoreboard
// blanks the board on SIGTERM. The children also exit if this process dies
// without getting here, when their IPC channel closes.
const shutdown = () => {
  [badgeScanChild, scorePointChild, vibrationChild, scoreboardChild].forEach(
    (child) => child.stop("SIGTERM")
  );
  process.exit();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const handleKeypress = (str, key) => {
  if (key.ctrl && key.name === "c") {
    shutdown();
  } else if (currentState === "registration") {
    onInputKeypress(key.name);
  } else {
    debouncedAppKeypress(key.name);
  }
};
process.stdin.on("keypress", handleKeypress);
