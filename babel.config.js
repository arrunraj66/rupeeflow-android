// Keep the Babel preset aligned with SDK 54 and its bundled Hermes compiler.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
