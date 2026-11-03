// Shows the score on the LED matrix (two MAX7219 8x8 modules) wired to this Pi.
// Forked by src/index.js, which sends { view } messages (see scoreboard/view.js).
//
// Run directly to check the wiring and orientation:
//   npm run scoreboard:test
// It should show "1" on the left and an underlined "2" on the right. If it's
// rotated, mirrored or swapped, set SCOREBOARD_ORIENTATION (0/90/180/270),
// SCOREBOARD_MIRROR=1 and/or SCOREBOARD_REVERSE=1 and run it again.

const { Gpio } = require("onoff");
const { pin } = require("../gpio");
const { createMax7219 } = require("../scoreboard/max7219");
const { renderScore, toModuleRows } = require("../scoreboard/render");
const { createScoreboard } = require("../scoreboard/view");

// BCM numbers (physical pins 38, 40 and 36, next to each other at the end of
// the header). GPIO18 is the vibration sensor; the RFID reader uses SPI0's pins.
const PINS = { din: pin(20), clk: pin(21), cs: pin(16) };

const env = process.env;
const layout = {
  orientation: Number(env.SCOREBOARD_ORIENTATION ?? 90),
  mirror: env.SCOREBOARD_MIRROR === "1",
  reverse: env.SCOREBOARD_REVERSE === "1",
};

const report = (message) =>
  process.send ? process.send(message) : console.log(message);

const display = createMax7219({
  Gpio,
  pins: PINS,
  modules: 2,
  intensity: Number(env.SCOREBOARD_INTENSITY ?? 1), // 0-15
});

const draw = (view) => {
  try {
    display.writeRows(toModuleRows(renderScore(view), layout));
  } catch (err) {
    report({ error: String(err) });
  }
};

if (process.argv.includes("--test")) {
  draw({ points: [1, 2], final: true, winner: 1 });
  console.log(
    'Showing "1" left and an underlined "2" right with layout',
    layout
  );
} else {
  const scoreboard = createScoreboard({ draw });
  draw(null);
  process.on("message", ({ view }) => scoreboard.show(view));

  // Blank the board and release the pins when the tracker stops.
  let closed = false;
  const shutdown = () => {
    if (closed) return;
    closed = true;
    display.close();
    process.exit(0);
  };
  process.on("disconnect", shutdown);
  process.on("SIGTERM", shutdown);
}
