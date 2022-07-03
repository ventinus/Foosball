const { Game } = require(".");
const api = require("../utils/api");

jest.useFakeTimers();
jest.mock("../utils/api");
jest.setSystemTime(new Date("2020-01-01"));
jest.spyOn(api, "updateGame");

let game;

const nowString = new Date().toISOString();
const init = (props = {}) =>
  Game("team1", "team2", {
    id: "game-id",
    sideAPoints: 0,
    sideBPoints: 0,
    startedAt: nowString,
    ...props,
  });

describe("Game", () => {
  beforeEach(jest.clearAllMocks);

  it("should initialize with predefined props", () => {
    const newProps = {
      id: "game-id",
      sideAPoints: 2,
      sideBPoints: 4,
      startedAt: nowString,
      endedAt: nowString,
    };
    expect(init(newProps).props).toEqual({
      t1: "team1",
      t2: "team2",
      ...newProps,
    });
  });

  it("should format the competitionId", () => {
    game = init();
    expect(game.competitionId).toBe("team1Vteam2");

    game = Game("t1::t2", "t3::t4", {});
    expect(game.competitionId).toBe("t1::t2Vt3::t4");
  });

  it("should scorePoint", () => {
    game = init({ sideAPoints: 0, sideBPoints: 0 });
    game.scorePoint(0);
    expect(game.teamPoints).toEqual([1, 0]);
    game.scorePoint(1);
    expect(game.teamPoints).toEqual([1, 1]);
    game.scorePoint(1);
    expect(game.teamPoints).toEqual([1, 2]);
    game.scorePoint(0);
    expect(game.teamPoints).toEqual([2, 2]);
  });

  it("should updateGame", () => {
    game = init();
    game.scorePoint(0);
    game.scorePoint(0);
    game.scorePoint(0);
    game.updateGame();
    expect(api.updateGame).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "game-id",
        sideAPoints: 3,
        sideBPoints: 0,
      })
    );
  });

  it("should reset the score", () => {
    game = init({ sideAPoints: 3, sideBPoints: 2, startedAt: "in-the-past" });
    game.resetScore();
    expect(api.updateGame).toHaveBeenCalledWith(
      expect.objectContaining({
        sideAPoints: 0,
        sideBPoints: 0,
        startedAt: nowString,
      })
    );
  });

  it("should endGame", () => {
    game = init();
    game.endGame();

    expect(api.updateGame).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "game-id",
        sideAPoints: 0,
        sideBPoints: 0,
        endedAt: nowString,
      })
    );
  });
});
