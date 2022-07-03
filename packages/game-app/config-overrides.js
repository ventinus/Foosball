const path = require("path");

module.exports = function override(config, env) {
  const loaders = config.resolve;
  loaders.fallback = {
    url: require.resolve("url"),
  };
  loaders.alias = {
    "@": path.resolve(__dirname, "src"),
  };

  return config;
};
