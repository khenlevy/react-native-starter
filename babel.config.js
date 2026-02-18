module.exports = function (api) {
  api.cache(true);

  const envFile = {
    development: '.env.development',
    production: '.env.production',
  }[process.env.APP_ENV || 'development']; // default fallback

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: envFile,
        safe: false,
        allowUndefined: true,
      }],
    ],
  };
};