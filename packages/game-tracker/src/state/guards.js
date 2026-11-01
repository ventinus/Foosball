// ---------------- Guards ----------------- //
exports.canActivate = ({ context: { players } }) => players.length >= 2;

exports.notPresent = ({ context: { players }, event: { id } }) =>
  !players.find((player) => player.id === id);

// TODO: make a more robust check such as win by 2
exports.gameComplete = ({ context: { currentGame } }) =>
  Math.max(...currentGame.teamPoints) >= 5;
