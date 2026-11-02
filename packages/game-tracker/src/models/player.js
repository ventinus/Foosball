const sync = require("../sync");

const Player = ({ id, alias }) => {
  const props = {
    alias,
    id,
  };

  return {
    get props() {
      return props;
    },
  };
};

// Falls back to locally known players when the API can't be reached.
Player.find = (id) => sync.findPlayer(id);

// Saved locally right away and sent to the API when it's reachable.
Player.create = async ({ id, alias }) => sync.registerPlayer({ id, alias });

module.exports = Player;
