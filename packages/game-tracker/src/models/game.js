const { pick } = require("lodash");
const api = require("../utils/api");
const { toCompetitionId } = require("../utils");

const Game = (t1, t2, initialProps) => {
  if (!t1 && !t2) {
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

  const updateGame = () =>
    api.updateGame(
      pick(props, ["id", "sideAPoints", "sideBPoints", "endedAt", "startedAt"])
    );

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
