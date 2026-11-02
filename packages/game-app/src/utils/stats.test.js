import {
  competitionSummary,
  gameSides,
  headToHead,
  leaderboard,
  playerSummary,
  toCompetitionId,
} from "./stats";

const players = (...pairs) => ({
  items: pairs.map(([playerID, alias]) => ({ playerID, player: { alias } })),
});
const roster = players(["1", "ann"], ["2", "bob"], ["3", "cat"], ["4", "dan"]);

const game = (id, competitionId, a, b, overrides = {}) => ({
  id,
  competitionId,
  switched: false,
  sideAPoints: a,
  sideBPoints: b,
  startedAt: `2026-01-0${id}T10:00:00.000Z`,
  endedAt: `2026-01-0${id}T10:10:00.000Z`,
  players: roster,
  ...overrides,
});

describe("stats", () => {
  it("builds competition ids the way the tracker does", () => {
    expect(toCompetitionId(["2"], ["1"])).toBe("1V2");
    expect(toCompetitionId(["4", "3"], ["2", "1"])).toBe("1::2V3::4");
  });

  describe("gameSides", () => {
    it("orders sides by `switched` and resolves the winner", () => {
      const [a, b] = gameSides(game("1", "1V2", 5, 3, { switched: true }));
      expect(a.players).toEqual([{ id: "2", alias: "bob" }]);
      expect(a).toMatchObject({ points: 5, won: true });
      expect(b).toMatchObject({ ids: ["1"], points: 3, won: false });
    });

    it("has no winner while the game is live", () => {
      const sides = gameSides(game("1", "1V2", 5, 3, { endedAt: null }));
      expect(sides.map((s) => s.won)).toEqual([false, false]);
    });

    it("splits doubles teams", () => {
      const [a, b] = gameSides(game("1", "1::2V3::4", 2, 5));
      expect(a.ids).toEqual(["1", "2"]);
      expect(b).toMatchObject({ ids: ["3", "4"], won: true });
    });

    it("splits uneven (1v2) teams", () => {
      const [a, b] = gameSides(game("1", "1::2V3", 4, 5));
      expect(a).toMatchObject({ ids: ["1", "2"], won: false });
      expect(b.players).toEqual([{ id: "3", alias: "cat" }]);
      expect(b.won).toBe(true);
    });

    it("counts a 1v2 game for every player but not as singles", () => {
      const games = [game("1", "1::2V3", 4, 5)];
      const board = leaderboard([], games);
      expect(board.find((row) => row.id === "3")).toMatchObject({
        games: 1,
        wins: 1,
      });
      expect(board.find((row) => row.id === "1")).toMatchObject({
        games: 1,
        losses: 1,
      });
      expect(headToHead(games, { singlesOnly: true }).players.size).toBe(0);
      expect(headToHead(games).get("3", "1")).toEqual({
        games: 1,
        wins: 1,
        losses: 0,
      });
    });
  });

  describe("playerSummary", () => {
    const games = [
      game("1", "1V2", 5, 3),
      game("2", "1V2", 1, 5),
      game("3", "1::3V2::4", 5, 4),
      game("4", "1V3", 5, 0),
      game("5", "1V2", 0, 0, { endedAt: null }),
    ];
    const summary = playerSummary("1", games);

    it("tallies the record and goals from finished games", () => {
      expect(summary).toMatchObject({
        played: 4,
        wins: 3,
        losses: 1,
        winRate: 0.75,
        goalsFor: 16,
        goalsAgainst: 12,
        goalDiff: 4,
      });
    });

    it("lists history newest first, with live games unresolved", () => {
      expect(summary.history.map((h) => [h.game.id, h.result])).toEqual([
        ["5", null],
        ["4", "W"],
        ["3", "W"],
        ["2", "L"],
        ["1", "W"],
      ]);
      expect(summary.form.map((h) => h.result)).toEqual(["W", "W", "L", "W"]);
      expect(summary.streak).toEqual({ result: "W", count: 2 });
    });

    it("tracks rivals and partners", () => {
      expect(summary.opponents).toEqual([
        { id: "2", alias: "bob", games: 3, wins: 2, losses: 1, competitionId: "1V2" },
        { id: "3", alias: "cat", games: 1, wins: 1, losses: 0, competitionId: "1V3" },
        { id: "4", alias: "dan", games: 1, wins: 1, losses: 0 },
      ]);
      expect(summary.partners).toEqual([
        { id: "3", alias: "cat", games: 1, wins: 1, losses: 0 },
      ]);
    });

    it("reads the score from the player's side when switched", () => {
      const [entry] = playerSummary("1", [
        game("1", "1V2", 5, 2, { switched: true }),
      ]).history;
      expect(entry).toMatchObject({ result: "L" });
      expect(entry.mine.points).toBe(2);
      expect(entry.theirs.points).toBe(5);
    });
  });

  it("summarizes a competition in team order", () => {
    const summary = competitionSummary("1V2", [
      game("1", undefined, 5, 3),
      game("2", undefined, 5, 1, { switched: true }),
      game("3", undefined, 5, 4),
    ]);
    expect(summary.teams.map((t) => [t.players[0].alias, t.wins, t.goals])).toEqual([
      ["ann", 2, 11],
      ["bob", 1, 12],
    ]);
    expect(summary.played).toBe(3);
    expect(summary.avgMargin).toBeCloseTo(7 / 3);
  });

  it("ranks the leaderboard, keeping players without games last", () => {
    const rows = leaderboard(
      [
        { fobId: "1", alias: "ann" },
        { fobId: "9", alias: "zed" },
      ],
      [game("1", "1V2", 5, 3), game("2", "1V3", 5, 4), game("3", "2V3", 5, 2)]
    );
    expect(rows.map((r) => [r.alias, r.wins, r.losses, r.goalDiff])).toEqual([
      ["ann", 2, 0, 3],
      ["bob", 1, 1, 1],
      ["cat", 0, 2, -4],
      ["zed", 0, 0, 0],
    ]);
  });

  it("builds a mirrored head-to-head grid", () => {
    const games = [
      game("1", "1V2", 5, 3),
      game("2", "1V2", 2, 5),
      game("3", "1V2", 5, 0),
      game("4", "1::3V2::4", 5, 1),
    ];
    const all = headToHead(games);
    expect(all.get("1", "2")).toEqual({ games: 4, wins: 3, losses: 1 });
    expect(all.get("2", "1")).toEqual({ games: 4, wins: 1, losses: 3 });
    expect(all.get("1", "3")).toBeNull();

    const singles = headToHead(games, { singlesOnly: true });
    expect(singles.get("1", "2")).toEqual({ games: 3, wins: 2, losses: 1 });
    expect([...singles.players]).toEqual(["1", "2"]);
  });
});
