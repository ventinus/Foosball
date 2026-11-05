const { pick } = require("lodash");
const sync = require("../sync");
const { toCompetitionId, isSwitched } = require("../utils");

// t1 is the team on side A (goal sensor 0), t2 the team on side B.
const Game = (t1, t2, initialProps) => {
  if (!t1 || !t2) {
    console.log("Two teams must be present to create a game, ending");
    return;
  }

  const props = {
    t1: t1,
    t2: t2,
    sideAPoints: initialProps.sideAPoints,
    sideBPoints: initialProps.sideBPoints,
    startedAt: initialProps.startedAt,
    endedAt: initialProps.endedAt,
    id: initialProps.id,
  };

  const competitionId = toCompetitionId(props.t1, props.t2);

  // Sides that scored, in order, so goals can be undone. Goals from before a
  // resume aren't known, so only goals scored since can be undone.
  const goals = [];

  // Saved locally right away and sent to the API when it's reachable.
  const updateGame = async () =>
    sync.saveGame({
      ...pick(props, ["id", "sideAPoints", "sideBPoints", "endedAt", "startedAt"]),
      switched: isSwitched(props.t1, props.t2),
      competitionId,
    });

  // Teams change ends; only before anyone scores, so points never move sides.
  const switchSides = () => {
    [props.t1, props.t2] = [props.t2, props.t1];
    return updateGame();
  };

  const resetScore = () => {
    goals.length = 0;
    props.sideAPoints = 0;
    props.sideBPoints = 0;
    props.startedAt = new Date().toISOString();
    return updateGame();
  };

  const endGame = () => {
    props.endedAt = new Date().toISOString();
    return updateGame();
  };

  const sideKey = (index) => `side${index === 0 ? "A" : "B"}Points`;

  const scorePoint = (index) => {
    goals.push(index);
    props[sideKey(index)]++;
  };

  // Takes back the latest goal; returns whether there was one to take back.
  const undoPoint = () => {
    if (!goals.length) return false;
    props[sideKey(goals.pop())]--;
    return true;
  };

  return {
    updateGame,
    resetScore,
    endGame,
    scorePoint,
    undoPoint,
    switchSides,
    competitionId,
    get props() {
      return props;
    },
    get completed() {
      return Boolean(props.endedAt);
    },
    get canUndo() {
      return goals.length > 0;
    },
    get teamPoints() {
      return [props.sideAPoints, props.sideBPoints];
    },
  };
};

module.exports = Game;
