const path = require("path");
const { createSync } = require("./sync");

// Where the tracker keeps its offline state (players, unsent games, outbox).
exports.DEFAULT_DATA_DIR =
  process.env.TRACKER_DATA_DIR ?? path.join(__dirname, "../../data");

// Status listeners follow whichever instance is current, so one added before
// init() keeps working after it.
const statusListeners = new Set();
const forwardStatus = (sync) =>
  sync.onStatus((status) =>
    statusListeners.forEach((listener) => listener(status))
  );

// Memory-only until init() is called, so tests and tools never touch the disk.
let instance = createSync({ autoFlush: false });
let unsubscribe = forwardStatus(instance);

// Replaces the shared instance; src/index.js calls this with the data dir.
exports.init = (options) => {
  instance.stop();
  unsubscribe();
  instance = createSync(options);
  unsubscribe = forwardStatus(instance);
  return instance;
};

// Calls `listener(status)` whenever the sync status changes; returns an unsubscribe.
exports.onStatus = (listener) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
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
  "status",
].forEach((name) => (exports[name] = delegate(name)));

