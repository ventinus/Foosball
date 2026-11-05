const lineup = require("./lineup");

// ---------------- Guards ----------------- //
// 1v1, 1v2/2v1 or 2v2
exports.canActivate = ({ context: { sides } }) => lineup.canStart(sides);

// The badge reader sends numeric ids, but ids from the API (fobId) are strings.
exports.notPresent = ({ context: { sides }, event: { id } }) =>
  !lineup.isSeated(sides, id);

// A new badge with every slot taken (a seated player rescanning is ignored).
exports.tableFull = ({ context: { sides }, event: { id } }) =>
  lineup.isFull(sides) && !lineup.isSeated(sides, id);

// Registration can't be confirmed with an empty alias.
exports.hasAlias = ({ context: { newPlayer } }) => newPlayer.alias.length > 0;

// Teams may change ends until the first goal.
exports.noGoals = ({ context: { currentGame } }) =>
  currentGame.teamPoints.every((points) => points === 0);

exports.canUndo = ({ context: { currentGame } }) => currentGame.canUndo;

// TODO: make a more robust check such as win by 2
exports.gameComplete = ({ context: { currentGame } }) =>
  Math.max(...currentGame.teamPoints) >= 5;
