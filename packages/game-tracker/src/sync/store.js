const fs = require("fs");
const path = require("path");

const emptyState = () => ({
  players: {}, // fobId -> alias, so badges can be recognized offline
  games: {}, // games with changes not yet sent to the API, by id
  outbox: [], // ordered changes waiting to be sent
  failed: [], // changes the API rejected for good, kept for inspection
});

// Persists the sync state as JSON. Without a `dataDir` it only lives in memory
// (tests, or running without a writable disk).
exports.createStore = (dataDir, { log = console.log } = {}) => {
  const file = dataDir && path.join(dataDir, "sync.json");

  const load = () => {
    if (!file || !fs.existsSync(file)) return emptyState();
    try {
      return { ...emptyState(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
    } catch (err) {
      // Keep the unreadable file for inspection rather than overwriting it.
      const aside = `${file}.corrupt-${Date.now()}`;
      fs.renameSync(file, aside);
      log(`sync state was unreadable, moved to ${aside}`, err);
      return emptyState();
    }
  };

  // Write to a temp file and rename it, so a power cut can't leave half a file.
  const save = (state) => {
    if (!file) return;
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, file);
  };

  return { load, save };
};
