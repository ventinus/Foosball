const child_process = require("child_process");
const {
  toCompetitionId,
  isSwitched,
  sideTeams,
  showCompetition,
  minToMs,
  registrationKeyEvent,
  breakBeamEvent,
} = require("./helpers");

describe("helpers", () => {
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => null);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("#toCompetitionId", () => {
    it("should form the competition ID", () => {
      expect(toCompetitionId("123", "345")).toBe("123V345");
      expect(toCompetitionId("345", "123")).toBe("123V345");
      expect(toCompetitionId("123::234", "345::456")).toBe("123::234V345::456");
      expect(toCompetitionId("234::456", "123::345")).toBe("123::345V234::456");
      expect(toCompetitionId("234::345", "123")).toBe("123V234::345");
    });
  });

  describe("#isSwitched", () => {
    it("should be false when side A's team sorts first", () => {
      expect(isSwitched("1", "2")).toBe(false);
      expect(isSwitched("1::2", "3::4")).toBe(false);
    });

    it("should be true when side A's team sorts second", () => {
      expect(isSwitched("2", "1")).toBe(true);
      expect(isSwitched("3::4", "1::2")).toBe(true);
      expect(isSwitched("3", "1::2")).toBe(true);
    });
  });

  describe("#sideTeams", () => {
    it("should list the teams in competition order when not switched", () => {
      expect(sideTeams("1::2V3::4", false)).toEqual(["1::2", "3::4"]);
    });

    it("should put the competition's second team on side A when switched", () => {
      expect(sideTeams("1::2V3::4", true)).toEqual(["3::4", "1::2"]);
    });

    it("should round-trip with isSwitched", () => {
      const [sideA, sideB] = ["3::4", "1::2"];
      const id = toCompetitionId(sideA, sideB);
      expect(sideTeams(id, isSwitched(sideA, sideB))).toEqual([sideA, sideB]);
    });
  });

  describe("#showCompetition", () => {
    const player = (alias) => ({ alias });

    it("should display with 1 player", () => {
      showCompetition([player("first")]);
      expect(console.log).toHaveBeenCalledWith(["first"]);
    });

    it("should display with 2 player", () => {
      showCompetition([player("first"), player("second")]);
      expect(console.log).toHaveBeenCalledWith(["first", "second"]);
    });
  });

  describe("#minToMs", () => {
    it("should convert minutes to milliseconds", () => {
      expect(minToMs(1)).toBe(60000);
      expect(minToMs(0)).toBe(0);
      expect(minToMs(2)).toBe(120000);
      expect(minToMs(5)).toBe(300000);
      expect(minToMs(10)).toBe(600000);
      expect(minToMs(60)).toBe(3600000);
    });
  });

  describe("registrationKeyEvent", () => {
    it("should append letters and digits", () => {
      expect(registrationKeyEvent("a")).toEqual({
        type: "APPEND_CHAR",
        character: "a",
      });
      expect(registrationKeyEvent("7")).toEqual({
        type: "APPEND_CHAR",
        character: "7",
      });
    });

    it("should map return, backspace and escape", () => {
      expect(registrationKeyEvent("return")).toEqual({ type: "CONFIRM" });
      expect(registrationKeyEvent("backspace")).toEqual({ type: "BACKSPACE" });
      expect(registrationKeyEvent("escape")).toEqual({ type: "DENY" });
    });

    it("should ignore punctuation (no key name) and other keys", () => {
      expect(registrationKeyEvent(undefined)).toBeNull();
      expect(registrationKeyEvent("tab")).toBeNull();
      expect(registrationKeyEvent("up")).toBeNull();
    });
  });

  describe("breakBeamEvent", () => {
    it("should score a point for the side A/B goal sensors", () => {
      expect(breakBeamEvent(0)).toEqual({ type: "SCORE_POINT", index: 0 });
      expect(breakBeamEvent(1)).toEqual({ type: "SCORE_POINT", index: 1 });
    });

    it("should start a game for higher sensors", () => {
      expect(breakBeamEvent(2)).toEqual({ type: "INITIATE_GAME" });
    });

    it("should ignore errors and anything that isn't a sensor index", () => {
      expect(breakBeamEvent({ error: "Error: EIO" })).toBeNull();
      expect(breakBeamEvent("POINT ERROR: Error: EIO")).toBeNull();
      expect(breakBeamEvent(undefined)).toBeNull();
      expect(breakBeamEvent(-1)).toBeNull();
      expect(breakBeamEvent(1.5)).toBeNull();
      expect(breakBeamEvent("1")).toBeNull();
    });
  });
});
