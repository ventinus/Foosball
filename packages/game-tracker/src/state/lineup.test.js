const {
  emptySides,
  playersOf,
  isSeated,
  isFull,
  canStart,
  seatPlayer,
  movePlayer,
  removePlayer,
  swapSides,
  teamsOf,
} = require("./lineup");

const p = (id) => ({ id, alias: `p${id}` });
const seatAll = (ids) => ids.map(p).reduce(seatPlayer, emptySides());

describe("lineup", () => {
  describe("#seatPlayer", () => {
    it("should fill side A, side B, side A, side B", () => {
      expect(seatAll(["1"])).toEqual([[p("1"), null], [null, null]]);
      expect(seatAll(["1", "2"])).toEqual([[p("1"), null], [p("2"), null]]);
      expect(seatAll(["1", "2", "3"])).toEqual([
        [p("1"), p("3")],
        [p("2"), null],
      ]);
      expect(seatAll(["1", "2", "3", "4"])).toEqual([
        [p("1"), p("3")],
        [p("2"), p("4")],
      ]);
    });

    it("should fill an opening left by a removed player", () => {
      const sides = removePlayer(seatAll(["1", "2", "3", "4"]), "2");
      expect(seatPlayer(sides, p("5"))).toEqual([
        [p("1"), p("3")],
        [p("5"), p("4")],
      ]);
    });

    it("should not seat anyone at a full table", () => {
      const sides = seatAll(["1", "2", "3", "4"]);
      expect(seatPlayer(sides, p("5"))).toBe(sides);
    });
  });

  describe("#movePlayer", () => {
    it("should move a player to an empty slot", () => {
      expect(movePlayer(seatAll(["1", "2", "3"]), "3", 1, 1)).toEqual([
        [p("1"), null],
        [p("2"), p("3")],
      ]);
    });

    it("should swap with whoever is in the slot", () => {
      expect(movePlayer(seatAll(["1", "2", "3", "4"]), "1", 1, 0)).toEqual([
        [p("2"), p("3")],
        [p("1"), p("4")],
      ]);
    });

    it("should match numeric and string ids", () => {
      expect(movePlayer(seatAll(["1", "2"]), 1, 0, 1)).toEqual([
        [null, p("1")],
        [p("2"), null],
      ]);
    });

    it("should ignore unknown players and slots", () => {
      const sides = seatAll(["1", "2"]);
      expect(movePlayer(sides, "9", 0, 0)).toBe(sides);
      expect(movePlayer(sides, "1", 2, 0)).toBe(sides);
      expect(movePlayer(sides, "1", 0, 2)).toBe(sides);
      expect(movePlayer(sides, "1", "0", 0)).toBe(sides);
    });
  });

  it("should remove a player", () => {
    expect(removePlayer(seatAll(["1", "2"]), 2)).toEqual([
      [p("1"), null],
      [null, null],
    ]);
  });

  it("should swap sides", () => {
    expect(swapSides(seatAll(["1", "2", "3"]))).toEqual([
      [p("2"), null],
      [p("1"), p("3")],
    ]);
  });

  it("should list the seated players", () => {
    expect(playersOf(seatAll(["1", "2", "3"]))).toEqual([p("1"), p("3"), p("2")]);
    expect(playersOf(emptySides())).toEqual([]);
  });

  it("should know who is seated", () => {
    expect(isSeated(seatAll(["1"]), 1)).toBe(true);
    expect(isSeated(seatAll(["1"]), "2")).toBe(false);
  });

  it("should know when the table is full", () => {
    expect(isFull(seatAll(["1", "2", "3"]))).toBe(false);
    expect(isFull(seatAll(["1", "2", "3", "4"]))).toBe(true);
  });

  it("should start only with a player on each side", () => {
    expect(canStart(emptySides())).toBe(false);
    expect(canStart(seatAll(["1"]))).toBe(false);
    expect(canStart(movePlayer(seatAll(["1", "2"]), "2", 0, 1))).toBe(false);
    expect(canStart(seatAll(["1", "2"]))).toBe(true);
    expect(canStart(seatAll(["1", "2", "3"]))).toBe(true);
  });

  it("should form each side's team from sorted ids", () => {
    expect(teamsOf(seatAll(["4", "2", "3", "1"]))).toEqual(["3::4", "1::2"]);
    expect(teamsOf(seatAll(["2", "1", "3"]))).toEqual(["2::3", "1"]);
  });
});
