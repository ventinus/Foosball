import { competitionIdToTeams } from "./competition-helpers";

describe("CompetitionHelpers", () => {
  describe("#competitionIdToTeams", () => {
    it("should handle a 2 player competition", () => {
      expect(
        competitionIdToTeams({
          competitionId: "1V2",
          players: [
            { playerID: "1", alias: "foo" },
            { playerID: "2", alias: "bar" },
          ],
          switched: false,
        })
      ).toEqual({
        sideA: [{ playerID: "1", alias: "foo" }],
        sideB: [{ playerID: "2", alias: "bar" }],
      });
    });

    it("should handle a 2 player competition switched", () => {
      expect(
        competitionIdToTeams({
          competitionId: "1V2",
          players: [
            { playerID: "1", alias: "foo" },
            { playerID: "2", alias: "bar" },
          ],
          switched: true,
        })
      ).toEqual({
        sideA: [{ playerID: "2", alias: "bar" }],
        sideB: [{ playerID: "1", alias: "foo" }],
      });
    });

    it("should handle a 4 player competition", () => {
      expect(
        competitionIdToTeams({
          competitionId: "1::2V3::4",
          players: [
            { playerID: "1", alias: "foo" },
            { playerID: "2", alias: "bar" },
            { playerID: "3", alias: "baz" },
            { playerID: "4", alias: "pot" },
          ],
          switched: false,
        })
      ).toEqual({
        sideA: [
          { playerID: "1", alias: "foo" },
          { playerID: "2", alias: "bar" },
        ],
        sideB: [
          { playerID: "3", alias: "baz" },
          { playerID: "4", alias: "pot" },
        ],
      });
    });

    it("should handle a 4 player competition switched", () => {
      expect(
        competitionIdToTeams({
          competitionId: "1::2V3::4",
          players: [
            { playerID: "1", alias: "foo" },
            { playerID: "2", alias: "bar" },
            { playerID: "3", alias: "baz" },
            { playerID: "4", alias: "pot" },
          ],
          switched: true,
        })
      ).toEqual({
        sideA: [
          { playerID: "3", alias: "baz" },
          { playerID: "4", alias: "pot" },
        ],
        sideB: [
          { playerID: "1", alias: "foo" },
          { playerID: "2", alias: "bar" },
        ],
      });
    });
  });
});
