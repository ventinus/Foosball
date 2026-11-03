const { renderScore, toModuleRows, ORIENTATIONS } = require("./render");
const { createMax7219 } = require("./max7219");
const { scoreboardView, createScoreboard } = require("./view");

// Frame rows as strings, e.g. "..#.....#.......", for readable assertions.
const pictured = (frame) =>
  frame.map((row) => row.map((on) => (on ? "#" : ".")).join(""));

describe("renderScore", () => {
  it("draws side A on the left module and side B on the right", () => {
    expect(pictured(renderScore({ points: [1, 4], final: false }))).toEqual([
      "................",
      "...#......#.#...",
      "..##......#.#...",
      "...#......###...",
      "...#........#...",
      "..###.......#...",
      "................",
      "................",
    ]);
  });

  it("underlines the winner when the game is over", () => {
    const frame = pictured(renderScore({ points: [5, 3], final: true, winner: 0 }));
    expect(frame[7]).toBe("..###...........");
  });

  it("fits two digits on a module", () => {
    const frame = pictured(renderScore({ points: [10, 0], final: false }));
    expect(frame[1]).toBe(".#..###...###...");
  });

  it("is blank without a game", () => {
    expect(pictured(renderScore(null)).join("")).not.toContain("#");
  });
});

describe("toModuleRows", () => {
  // Lights only the top-left pixel of the left module.
  const corner = () => {
    const frame = renderScore(null);
    frame[0][0] = 1;
    return frame;
  };

  it("maps rows to bytes with the leftmost column as the high bit", () => {
    const [left, right] = toModuleRows(renderScore({ points: [1, 4] }));
    expect(left.map((b) => b.toString(2).padStart(8, "0"))).toEqual([
      "00000000",
      "00010000",
      "00110000",
      "00010000",
      "00010000",
      "00111000",
      "00000000",
      "00000000",
    ]);
    expect(right[1]).toBe(0b00101000);
  });

  it.each([
    [0, 0, 0b10000000],
    [90, 0, 0b00000001],
    [180, 7, 0b00000001],
    [270, 7, 0b10000000],
  ])("rotates a module mounted at %i degrees", (orientation, row, byte) => {
    const [left] = toModuleRows(corner(), { orientation });
    expect(left[row]).toBe(byte);
    expect(left.filter(Boolean)).toHaveLength(1);
  });

  it("mirrors and reverses the chain order", () => {
    const [first, second] = toModuleRows(corner(), { mirror: true, reverse: true });
    expect(first.every((b) => b === 0)).toBe(true);
    expect(second[0]).toBe(0b00000001);
  });

  it("rejects unknown orientations", () => {
    expect(ORIENTATIONS).toEqual([0, 90, 180, 270]);
    expect(() => toModuleRows(corner(), { orientation: 45 })).toThrow();
  });
});

describe("createMax7219", () => {
  // Records the 16-bit words latched into each module, in chain order.
  const fakeGpio = () => {
    const pins = {};
    const latched = [];
    let shifted = [];
    class Gpio {
      constructor(pin) {
        this.pin = pin;
        this.value = 0;
        pins[pin] = this;
      }
      writeSync(value) {
        const rising = !this.value && value;
        this.value = value;
        if (this.pin === "clk" && rising) shifted.push(pins.din.value);
        // (raising CS with nothing shifted in, as at startup, latches nothing)
        if (this.pin === "cs" && rising && shifted.length) {
          const words = [];
          for (let i = 0; i < shifted.length; i += 16) {
            words.push(parseInt(shifted.slice(i, i + 16).join(""), 2));
          }
          // the last word shifted in stays in the module nearest DIN
          latched.push(words.reverse());
          shifted = [];
        }
      }
      unexport() {
        this.unexported = true;
      }
    }
    return { Gpio, latched, pins };
  };

  it("initializes the chain, then writes each module's rows", () => {
    const { Gpio, latched } = fakeGpio();
    const display = createMax7219({
      Gpio,
      pins: { din: "din", clk: "clk", cs: "cs" },
      intensity: 3,
    });
    const rows = (start) => Array.from({ length: 8 }, (_, i) => start + i);
    display.writeRows([rows(0x10), rows(0x20)]);

    expect(latched.slice(0, 5)).toEqual([
      [0x0f00, 0x0f00],
      [0x0900, 0x0900],
      [0x0b07, 0x0b07],
      [0x0a03, 0x0a03],
      [0x0c01, 0x0c01],
    ]);
    expect(latched.slice(5)).toEqual(
      rows(0).map((i) => [((i + 1) << 8) | (0x10 + i), ((i + 1) << 8) | (0x20 + i)])
    );
  });

  it("blanks the modules and releases the pins on close", () => {
    const { Gpio, latched, pins } = fakeGpio();
    createMax7219({ Gpio, pins: { din: "din", clk: "clk", cs: "cs" } }).close();

    expect(latched).toEqual([[0x0c00, 0x0c00]]);
    expect(Object.values(pins).every((pin) => pin.unexported)).toBe(true);
  });
});

describe("scoreboardView", () => {
  const snapshot = (state, teamPoints) => ({
    matches: (value) => value === state,
    context: { currentGame: teamPoints ? { teamPoints } : null },
  });

  it("shows the score during a game", () => {
    expect(scoreboardView(snapshot("active", [2, 1]))).toEqual({
      points: [2, 1],
      final: false,
      winner: null,
    });
    expect(scoreboardView(snapshot("pauseWarning", [2, 1]))?.points).toEqual([2, 1]);
  });

  it("marks the winner when the game completes", () => {
    expect(scoreboardView(snapshot("complete", [3, 5]))).toEqual({
      points: [3, 5],
      final: true,
      winner: 1,
    });
  });

  it("is blank between games", () => {
    expect(scoreboardView(snapshot("inactive", null))).toBe(null);
    expect(scoreboardView(snapshot("pending", null))).toBe(null);
  });
});

describe("createScoreboard", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const final = { points: [5, 2], final: true, winner: 0 };

  it("keeps the final score up before blanking", () => {
    const draw = jest.fn();
    const board = createScoreboard({ draw, lingerMs: 1000 });
    board.show(final);
    board.show(null);
    expect(draw).toHaveBeenLastCalledWith(final);

    jest.advanceTimersByTime(999);
    expect(draw).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(draw).toHaveBeenLastCalledWith(null);
  });

  it("replaces the final score as soon as a new game starts", () => {
    const draw = jest.fn();
    const board = createScoreboard({ draw, lingerMs: 1000 });
    board.show(final);
    board.show(null);
    board.show({ points: [0, 0], final: false, winner: null });

    jest.advanceTimersByTime(5000);
    expect(draw).toHaveBeenLastCalledWith({ points: [0, 0], final: false, winner: null });
  });

  it("blanks right away when no game just finished", () => {
    const draw = jest.fn();
    createScoreboard({ draw }).show(null);
    expect(draw).toHaveBeenCalledWith(null);
  });
});
