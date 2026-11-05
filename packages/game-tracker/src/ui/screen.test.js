const { createActor } = require("xstate");

const { gameMachine, initialContext } = require("../state/config");
const lineup = require("../state/lineup");
const Game = require("../models/game");
const sync = require("../sync");
const { screenView } = require("./screen");

jest.mock("../utils/helpers", () => ({
  ...jest.requireActual("../utils/helpers"),
  prompt: jest.fn(),
  beep: jest.fn(),
  showCompetition: jest.fn(),
}));

const seat = (...ids) =>
  ids.map((id) => ({ id, alias: `p${id}` })).reduce(lineup.seatPlayer, lineup.emptySides());

let actor;
const at = (value, context = {}) => {
  const snapshot = gameMachine.resolveState({
    value,
    context: { ...initialContext, ...context },
  });
  actor = createActor(gameMachine, { snapshot }).start();
  return screenView(actor.getSnapshot(), { sync: { online: true } });
};

const game = (a, b) => Game("1", "2", { id: "g", sideAPoints: a, sideBPoints: b });

describe("screenView", () => {
  beforeEach(() => sync.init({ autoFlush: false }));
  afterEach(() => actor?.stop());

  it("should ask for a badge when nobody is at the table", () => {
    expect(at("inactive")).toMatchObject({
      screen: "idle",
      sides: [
        [null, null],
        [null, null],
      ],
      canStart: false,
      score: null,
      deadline: null,
      status: { sync: { online: true } },
    });
  });

  it("should show the lineup and whether a coin would start it", () => {
    const view = at("inactive", { sides: seat("1", "2", "3") });
    expect(view).toMatchObject({
      screen: "lineup",
      sides: [
        [
          { id: "1", alias: "p1" },
          { id: "3", alias: "p3" },
        ],
        [{ id: "2", alias: "p2" }, null],
      ],
      canStart: true,
      full: false,
    });
    expect(view.actions).toEqual(
      expect.arrayContaining(["MOVE_PLAYER", "REMOVE_PLAYER", "SWAP_SIDES"])
    );
    expect(view.actions).not.toContain("UNDO_GOAL");

    expect(at("inactive", { sides: seat("1") }).canStart).toBe(false);
    expect(at("inactive", { sides: seat("1", "2", "3", "4") }).full).toBe(true);
  });

  it("should show registration with its countdown", () => {
    const view = at("registration", {
      newPlayer: { id: 777, alias: "jo" },
      deadline: 1000,
    });
    expect(view).toMatchObject({
      screen: "register",
      newPlayer: { id: "777", alias: "jo" },
      deadline: 1000,
    });
    expect(view.actions).toEqual(
      expect.arrayContaining(["SET_ALIAS", "CONFIRM", "DENY"])
    );
  });

  it("should not offer to save an empty name", () => {
    const view = at("registration", { newPlayer: { id: "7", alias: "" } });
    expect(view.actions).not.toContain("CONFIRM");
  });

  it("should show the old score when offering to resume", () => {
    expect(at("shouldResume", { sides: seat("1", "2"), currentGame: game(3, 1) }))
      .toMatchObject({ screen: "resume", score: [3, 1] });
  });

  it("should offer side swaps only before the first goal", () => {
    const fresh = at("active", { sides: seat("1", "2"), currentGame: game(0, 0) });
    expect(fresh).toMatchObject({ screen: "playing", score: [0, 0] });
    expect(fresh.actions).toContain("SWAP_SIDES");
    expect(fresh.actions).not.toContain("UNDO_GOAL");

    const g = game(0, 0);
    g.scorePoint(1);
    const scored = at("active", { sides: seat("1", "2"), currentGame: g });
    expect(scored.actions).not.toContain("SWAP_SIDES");
    expect(scored.actions).toEqual(expect.arrayContaining(["UNDO_GOAL", "ABANDON"]));
  });

  it("should show the pause warning's countdown", () => {
    expect(
      at("pauseWarning", { sides: seat("1", "2"), currentGame: game(2, 2), deadline: 5 })
    ).toMatchObject({ screen: "stillPlaying", deadline: 5 });
  });

  it("should show the winner, with undo until the game is saved", () => {
    const g = game(4, 4);
    g.scorePoint(0);
    const confirming = at(
      { complete: "confirming" },
      { sides: seat("1", "2"), currentGame: g, deadline: 9 }
    );
    expect(confirming).toMatchObject({
      screen: "final",
      score: [5, 4],
      winner: 0,
      saved: false,
      deadline: 9,
    });
    expect(confirming.actions).toEqual(expect.arrayContaining(["UNDO_GOAL", "REMATCH"]));

    const saved = at({ complete: "saved" }, { sides: seat("1", "2"), currentGame: g });
    expect(saved).toMatchObject({ saved: true, winner: 0 });
    expect(saved.actions).toContain("REMATCH");
    expect(saved.actions).not.toContain("UNDO_GOAL");
  });
});
