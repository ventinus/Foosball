const api = require("../utils/api");

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

Player.find = (id) => api.findPlayer(id);

Player.create = ({ id, alias }) => api.createPlayer({ alias, fobId: id });

module.exports = Player;
