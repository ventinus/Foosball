// ---------------- Guards ----------------- //
exports.canActivate = ({ context: { players } }) => players.length >= 2;

// The badge reader sends numeric ids, but ids from the API (fobId) are strings.
exports.notPresent = ({ context: { players }, event: { id } }) =>
  !players.some((player) => String(player.id) === String(id));

// TODO: make a more robust check such as win by 2
exports.gameComplete = ({ context: { currentGame } }) =>
  Math.max(...currentGame.teamPoints) >= 5;
