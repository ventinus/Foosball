const { createActor } = require("xstate");
const os = require("os");
const path = require("path");
const readline = require("readline");
const debounce = require("lodash/debounce");
const throttle = require("lodash/throttle");
const { Amplify } = require("aws-amplify");

// TRACKER_SIMULATE=1 runs the tracker without the table: no sensors, and the
// screen gets buttons that stand in for them (badge scans, goals, the coin
// slot). It never talks to the API, so practice games stay out of the real
// data; they're kept in data/simulator.
const SIMULATE = process.env.TRACKER_SIMULATE === "1";

const { gameMachine } = require("./state/config");
const {
  BADGE_SCAN,
  INITIATE_GAME,
  SCORE_POINT,
  CONFIRM,
  PAUSE,
  GAME_ACTIVITY,
  WARN_PAUSE,
  DENY,
  UNDO_GOAL,
  REMATCH,
  SWAP_SIDES,
  ABANDON,
} = require("./state/actionTypes");
const {
  childProcess,
  minToMs,
  registrationKeyEvent,
  breakBeamEvent,
} = require("./utils");
const { scoreboardView } = require("./utils/scoreboard/view");
const { screenView } = require("./ui/screen");
const { createServer } = require("./server");
const sync = require("./sync");

if (!SIMULATE) {
  // `amplify pull` writes aws-exports.js as an ES module (`export default`);
  // Node 24's require(esm) returns its namespace, so unwrap `default`.
  const awsExports = require("./aws-exports");
  Amplify.configure(awsExports.default ?? awsExports);
}

// Players and games are saved locally first and sent to the API when it's
// reachable, so the table keeps working offline.
sync.init(
  SIMULATE
    ? { dataDir: path.join(sync.DEFAULT_DATA_DIR, "simulator"), autoFlush: false }
    : { dataDir: sync.DEFAULT_DATA_DIR }
);
if (!SIMULATE) sync.refreshPlayers();

// A sensor (or the scoreboard) running as its own process, or a stand-in that
// does nothing when simulating.
const device = (...args) =>
  SIMULATE
    ? { connected: false, restarts: 0, send: () => {}, stop: () => {} }
    : childProcess(...args);

// The LED matrix scoreboard wired to this Pi.
const scoreboardChild = device(
  "scoreboard.js",
  (message) => console.log("scoreboard", message),
  (err) => console.log("onScoreboardError", err),
  // a restarted scoreboard starts blank; show it the current view
  {
    onRestart: () => {
      resendScoreboard();
      updateScreen();
    },
    onExit: () => updateScreen(),
  }
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
  updateScreen();
});

// The table's screen: a page served to the iPad (src/server), sent the
// screen view whenever it changes.
const sensorStatus = () =>
  SIMULATE
    ? []
    : Object.entries({
    badgeReader: badgeScanChild,
    goals: scorePointChild,
    vibration: vibrationChild,
    scoreboard: scoreboardChild,
  }).map(([name, child]) => ({
    name,
    running: Boolean(child?.connected),
    restarts: child?.restarts ?? 0,
  }));

const currentScreen = () =>
  screenView(gameService.getSnapshot(), {
    sync: sync.status(),
    sensors: sensorStatus(),
    simulate: SIMULATE,
  });

// Set once the server is listening, which is after this file has run, so
// updateScreen() never reaches the sensor processes defined further down
// before they exist.
let screenServer = null;
let lastScreen;
const updateScreen = () => {
  if (!screenServer) return;
  const view = currentScreen();
  const key = JSON.stringify(view);
  if (key === lastScreen) return;
  lastScreen = key;
  screenServer.broadcast(view);
};

sync.onStatus(() => updateScreen());

// The simulator's stand-ins for the sensors.
const SENSOR_COMMANDS = [BADGE_SCAN, SCORE_POINT, INITIATE_GAME, WARN_PAUSE];

const onScreenCommand = (event) => {
  if (SIMULATE && SENSOR_COMMANDS.includes(event.type)) {
    // "Go idle" skips the inactivity wait; anything else counts as play.
    if (event.type === WARN_PAUSE) return warnInactive();
    onVibration();
  }
  gameService.send(event);
};

createServer({
  port: Number(process.env.TRACKER_UI_PORT ?? 8080),
  getView: currentScreen,
  onCommand: onScreenCommand,
  extraCommands: SIMULATE ? SENSOR_COMMANDS : [],
}).then((server) => {
  screenServer = server;
  const host = SIMULATE ? "localhost" : `${os.hostname()}.local`;
  console.log(`Table screen: http://${host}:${server.port}`);
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
// Keys on the Pi's keyboard, outside of typing an alias.
const APP_KEYS = {
  y: CONFIRM,
  return: CONFIRM,
  n: DENY,
  u: UNDO_GOAL,
  r: REMATCH,
  s: SWAP_SIDES,
  x: ABANDON,
};

const onAppKeypress = (keyName) => {
  const type = APP_KEYS[keyName];
  if (type) gameService.send({ type });
};

const onInputKeypress = (keyName) => {
  const event = registrationKeyEvent(keyName);
  if (event) gameService.send(event);
};

const INACTIVITY_WARN_MS = minToMs(2); // no vibration for this long → warn
const PAUSE_GRACE_MS = minToMs(1); // time to respond to the warning before the game resets

let gameWarnId = 0;
let gamePauseId = 0;

// Asks whether anyone's still playing, and pauses if nobody answers in time.
const warnInactive = () => {
  clearTimeout(gameWarnId);
  clearTimeout(gamePauseId);
  gameService.send({ type: WARN_PAUSE, endsAt: Date.now() + PAUSE_GRACE_MS });
  gamePauseId = setTimeout(
    () => gameService.send({ type: PAUSE }),
    PAUSE_GRACE_MS
  );
};

const onVibration = () => {
  clearTimeout(gameWarnId);
  clearTimeout(gamePauseId);

  if (currentState === "pauseWarning") gameService.send({ type: GAME_ACTIVITY });

  gameWarnId = setTimeout(warnInactive, INACTIVITY_WARN_MS);
};

const onBadgeScanError = (err) => console.log("onBadgeScanError", err);
const onGameStartError = (err) => console.log("onGameStartError", err);
const onBreakBeamError = (err) => console.log("onBreakBeamError", err);

const debounceOptions = { leading: true, trailing: false };
// Sensor restarts show on the screen's status line.
const sensorOptions = {
  onExit: () => updateScreen(),
  onRestart: () => updateScreen(),
};
const badgeScanChild = device(
  "readCard.js",
  debounce(onBadgeScan, 2000, debounceOptions),
  onBadgeScanError,
  sensorOptions
);
// const gameStartChild = childProcess('gameStart.js', onGameStart, onGameStartError)
const scorePointChild = device(
  "scorePoint.js",
  onBreakBeam,
  onBreakBeamError,
  sensorOptions
);
// throttle (not debounce): continuous vibration must keep resetting the inactivity timer
const vibrationChild = device(
  "vibration.js",
  throttle(onVibration, 300, debounceOptions),
  undefined,
  sensorOptions
);

// The Pi's keyboard. Without a terminal (e.g. the simulator run in the
// background) the screen is the only input.
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
}

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
