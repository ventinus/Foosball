// Draws the score for two cascaded 8x8 LED modules (16x8 pixels): side A's
// points on the left module, side B's on the right.

const MODULE_SIZE = 8;
const MODULES = 2;
const WIDTH = MODULE_SIZE * MODULES;
const HEIGHT = MODULE_SIZE;

// 3x5 digits, one string per row ("1" = lit).
const DIGITS = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "001", "001", "001"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
};
const GLYPH_WIDTH = 3;
const GLYPH_TOP = 1;
const UNDERLINE_ROW = HEIGHT - 1;

const blankFrame = () =>
  Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));

// `view` is { points: [a, b], final, winner } or null for a blank board.
// The winner's score is underlined once the game is over.
exports.renderScore = (view) => {
  const frame = blankFrame();
  if (!view) return frame;

  view.points.forEach((points, side) => {
    const text = String(Math.min(Math.max(points, 0), 99));
    const width = text.length * (GLYPH_WIDTH + 1) - 1;
    const left = side * MODULE_SIZE + Math.floor((MODULE_SIZE - width) / 2);

    [...text].forEach((char, i) => {
      DIGITS[char].forEach((row, y) =>
        [...row].forEach((bit, x) => {
          if (bit === "1") frame[GLYPH_TOP + y][left + i * (GLYPH_WIDTH + 1) + x] = 1;
        })
      );
    });

    if (view.final && view.winner === side) {
      for (let x = left; x < left + width; x++) frame[UNDERLINE_ROW][x] = 1;
    }
  });

  return frame;
};

// Where logical pixel (x, y) of a module lands for each way a module can be
// mounted, as clockwise rotations.
const ROTATIONS = {
  0: (x, y) => [x, y],
  90: (x, y) => [MODULE_SIZE - 1 - y, x],
  180: (x, y) => [MODULE_SIZE - 1 - x, MODULE_SIZE - 1 - y],
  270: (x, y) => [y, MODULE_SIZE - 1 - x],
};

exports.ORIENTATIONS = Object.keys(ROTATIONS).map(Number);

// Converts a frame to the 8 row bytes each MAX7219 expects (bit 7 = leftmost
// column), ordered from the module nearest the Pi's DIN wire. The layout
// options correct for how the modules are mounted and chained.
exports.toModuleRows = (frame, { orientation = 0, mirror = false, reverse = false } = {}) => {
  const rotate = ROTATIONS[orientation];
  if (!rotate) throw new Error(`orientation must be one of ${exports.ORIENTATIONS}`);

  const modules = Array.from({ length: MODULES }, (_, m) => {
    const rows = Array(MODULE_SIZE).fill(0);
    for (let y = 0; y < MODULE_SIZE; y++) {
      for (let x = 0; x < MODULE_SIZE; x++) {
        if (!frame[y][m * MODULE_SIZE + x]) continue;
        const [px, py] = rotate(mirror ? MODULE_SIZE - 1 - x : x, y);
        rows[py] |= 1 << (MODULE_SIZE - 1 - px);
      }
    }
    return rows;
  });

  return reverse ? modules.reverse() : modules;
};
