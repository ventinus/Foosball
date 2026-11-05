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
    props.sideAPoints = 0;
    props.sideBPoints = 0;
    props.startedAt = new Date().toISOString();
    return updateGame();
  };

  const endGame = () => {
    props.endedAt = new Date().toISOString();
    return updateGame();
  };

  const scorePoint = (index) => props[`side${index === 0 ? "A" : "B"}Points`]++;

  return {
    updateGame,
    resetScore,
    endGame,
    scorePoint,
    switchSides,
    competitionId,
    get props() {
      return props;
    },
    get completed() {
      return props.endedAt !== null;
    },
    get teamPoints() {
      return [props.sideAPoints, props.sideBPoints];
    },
  };
};

module.exports = Game;
