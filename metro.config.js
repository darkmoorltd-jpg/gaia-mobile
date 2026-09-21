const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Polyfill Node.js core modules that some packages need
config.resolver.extraNodeModules = {
  punycode: require.resolve('punycode/'),
};

module.exports = config;
