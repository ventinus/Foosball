const path = require("path");
const { createSync } = require("./sync");

// Where the tracker keeps its offline state (players, unsent games, outbox).
exports.DEFAULT_DATA_DIR =
  process.env.TRACKER_DATA_DIR ?? path.join(__dirname, "../../data");

// Memory-only until init() is called, so tests and tools never touch the disk.
let instance = createSync({ autoFlush: false });

// Replaces the shared instance; src/index.js calls this with the data dir.
exports.init = (options) => {
  instance.stop();
  instance = createSync(options);
  return instance;
};

const delegate = (name) => (...args) => instance[name](...args);

[
  "findPlayer",
  "registerPlayer",
  "refreshPlayers",
  "createGame",
  "saveGame",
  "findUnfinishedGame",
  "flush",
  "stop",
  "pending",
  "failed",
].forEach((name) => (exports[name] = delegate(name)));
