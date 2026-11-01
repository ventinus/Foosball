const { createActor } = require("xstate");
const readline = require("readline");
const debounce = require("lodash/debounce");
const { Amplify } = require("aws-amplify");

// `amplify pull` writes aws-exports.js as an ES module (`export default`); Node 24's
// require(esm) returns its namespace, so unwrap `default` when present.
const awsExports = require("./aws-exports");
const awsconfig = awsExports.default ?? awsExports;

const { gameMachine } = require("./state/config");
const {
  INITIATE_GAME,
  BADGE_SCAN,
  SCORE_POINT,
  APPEND_CHAR,
  BACKSPACE,
  CONFIRM,
  PAUSE,
  GAME_ACTIVITY,
  WARN_PAUSE,
  DENY,
} = require("./state/actionTypes");
const { childProcess, minToMs } = require("./utils");

Amplify.configure(awsconfig);

const gameService = createActor(gameMachine);
let currentState;
gameService.subscribe((snapshot) => {
  currentState = snapshot.value;
});
gameService.start();

const onBadgeScan = ({ message, id }) => {
  if (message) {
    console.log("FROM SCAN", message);
  } else if (id) {
    gameService.send({ type: BADGE_SCAN, id });
  }
};

const onBreakBeam = (index) => {
  console.log("break beam", index);
  return index <= 1
    ? gameService.send({ type: SCORE_POINT, index })
    : gameService.send({ type: INITIATE_GAME });
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
  if (keyName.length === 1 && /[a-z0-9]/.test(keyName)) {
    gameService.send({ type: APPEND_CHAR, character: keyName });
  } else if (keyName === "return") {
    gameService.send({ type: CONFIRM });
  } else if (keyName === "backspace") {
    gameService.send({ type: BACKSPACE });
  }
};

let gameWarnId = 0;
let gamePauseId = 0;
const onVibration = () => {
  clearTimeout(gameWarnId);
  clearTimeout(gamePauseId);

  if (currentState === "pauseWarning") gameService.send({ type: GAME_ACTIVITY });

  gameWarnId = setTimeout(() => {
    gameService.send({ type: WARN_PAUSE });
    gamePauseId = setTimeout(() => gameService.send({ type: PAUSE }), 1);
  }, minToMs(2));
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
const vibrationChild = childProcess(
  "vibration.js",
  debounce(onVibration, 300, debounceOptions)
);

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

const handleKeypress = (str, key) => {
  if (key.ctrl && key.name === "c") {
    badgeScanChild.kill("SIGKILL");
    scorePointChild.kill("SIGKILL");
    vibrationChild.kill("SIGKILL");
    process.exit();
  } else if (currentState === "registration") {
    onInputKeypress(key.name);
  } else {
    onAppKeypress(key.name);
  }
};
process.stdin.on(
  "keypress",
  debounce(handleKeypress, 300, { leading: true, trailing: false })
);
