// ---------------- Guards ----------------- //
exports.canActivate = ({ players }) => players.length >= 2;

exports.notPresent = ({ players }, { id }) =>
  !players.find((player) => player.id === id);

// TODO: make a more robust check such as win by 2
exports.gameComplete = ({ currentGame }) =>
  Math.max(...currentGame.teamPoints) >= 5;
