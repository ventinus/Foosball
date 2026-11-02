const { isValidPlayerCount } = require("../utils/helpers");

// ---------------- Guards ----------------- //
// 1v1, 1v2/2v1 or 2v2
exports.canActivate = ({ context: { players } }) =>
  isValidPlayerCount(players.length);

// The badge reader sends numeric ids, but ids from the API (fobId) are strings.
exports.notPresent = ({ context: { players }, event: { id } }) =>
  !players.some((player) => String(player.id) === String(id));

// TODO: make a more robust check such as win by 2
exports.gameComplete = ({ context: { currentGame } }) =>
  Math.max(...currentGame.teamPoints) >= 5;
