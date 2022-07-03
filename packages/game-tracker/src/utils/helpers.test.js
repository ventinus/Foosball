const child_process = require("child_process");
const {
  formatTeams,
  toCompetitionId,
  showCompetition,
  minToMs,
} = require("./helpers");

const toPlayers = (ids) => ids.map((id) => ({ id }));

describe("helpers", () => {
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => null);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("#formatTeams", () => {
    it("should format 1 player teams", () => {
      expect(formatTeams(toPlayers([123, 345]))).toEqual(["123", "345"]);
      expect(formatTeams(toPlayers([345, 123]))).toEqual(["345", "123"]);
      expect(formatTeams(toPlayers(["123", "345"]))).toEqual(["123", "345"]);
      expect(formatTeams(toPlayers(["345", "123"]))).toEqual(["345", "123"]);
    });

    it("should format 2 player teams", () => {
      expect(formatTeams(toPlayers([123, 234, 345, 456]))).toEqual([
        "123::234",
        "345::456",
      ]);
      expect(formatTeams(toPlayers([234, 123, 456, 345]))).toEqual([
        "123::234",
        "345::456",
      ]);
      expect(formatTeams(toPlayers([456, 234, 123, 345]))).toEqual([
        "234::456",
        "123::345",
      ]);
      expect(formatTeams(toPlayers([456, 234, 345, 123]))).toEqual([
        "234::456",
        "123::345",
      ]);
      expect(formatTeams(toPlayers(["123", "234", "345", "456"]))).toEqual([
        "123::234",
        "345::456",
      ]);
      expect(formatTeams(toPlayers(["234", "123", "456", "345"]))).toEqual([
        "123::234",
        "345::456",
      ]);
      expect(formatTeams(toPlayers(["456", "234", "123", "345"]))).toEqual([
        "234::456",
        "123::345",
      ]);
      expect(formatTeams(toPlayers(["456", "234", "345", "123"]))).toEqual([
        "234::456",
        "123::345",
      ]);
    });
  });

  describe("#toCompetitionId", () => {
    it("should form the competition ID", () => {
      expect(toCompetitionId("123", "345")).toBe("123V345");
      expect(toCompetitionId("345", "123")).toBe("123V345");
      expect(toCompetitionId("123::234", "345::456")).toBe("123::234V345::456");
      expect(toCompetitionId("234::456", "123::345")).toBe("123::345V234::456");
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
});
