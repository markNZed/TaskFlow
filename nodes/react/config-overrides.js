/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

const path = require("path");

module.exports = {
  // The function to use to create a webpack dev server configuration when running the development
  // RxJS Processor Consumer with 'npm run start' or 'yarn start'.
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
      // Tried to change the path to reactws but it didn't work, not sure why.
      // Maybe need to use WDS_SOCKET_PATH
      config.client.webSocketURL = "auto://0.0.0.0:0/ws";

      /*
      config.client.webSocketURL = {
        hostname: '0.0.0.0',
        pathname: '/reactws',
        password: 'dev-server',
        port: 443,
        protocol: 'wss',
      };
      console.log("config.client ", config.client)
      */

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

    // Add Babel plugin
    const babelLoaderFilter = rule =>
      rule.loader &&
      rule.loader.includes('babel') &&
      rule.options &&
      rule.options.presets;
    // Find the Babel loader rule and modify it
    let loaders = config.module.rules.find(rule => Array.isArray(rule.oneOf))
      .oneOf;
    loaders.forEach(loader => {
      if (babelLoaderFilter(loader)) {
        loader.options.plugins = loader.options.plugins || [];
        loader.options.plugins.push('@babel/plugin-syntax-import-assertions');
      }
    });

    return config;
  },

};
