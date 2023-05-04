/* config-overrides.js */

const path = require("path");

module.exports = {
  // The function to use to create a webpack dev server configuration when running the development
  // server with 'npm run start' or 'yarn start'.
  // Example: set the dev server to use a specific certificate in https.
  devServer: function (configFunction) {
    // Return the replacement function for create-react-app to use to generate the Webpack
    // Development Server config. "configFunction" is the function that would normally have
    // been used to generate the Webpack Development server config - you can use it to create
    // a starting configuration to then modify instead of having to create a config from scratch.
    return function (proxy, allowedHost) {
      // Create the default config by calling configFunction with the proxy/allowedHost parameters
      const config = configFunction(proxy, allowedHost);

      // This allows the WebPack dev server to use the proxy
      //
      config.client.webSocketURL = "auto://0.0.0.0:0/ws";

      // Return your customised Webpack Development Server config.
      return config;
    };
  },

  webpack: function (config, env) {
    config.resolve.modules = [path.join(__dirname, "shared", "src")].concat(
      config.resolve.modules
    );
    config.resolve.modules = [path.resolve(__dirname, "src")].concat(
      config.resolve.modules
    );
    return config;
  },
};
