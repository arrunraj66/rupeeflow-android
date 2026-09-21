module.exports = function (api) {
  api.cache(true);
  // This Expo/RN toolchain includes the legacy Hermes compiler, so transform
  // modern class fields before bytecode compilation.
  return {
    presets: [['babel-preset-expo', { unstable_transformProfile: 'hermes-v0' }]],
  };
};
