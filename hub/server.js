/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// 3rd party modules
import express from "express";
import cors from "cors";
import http from "http";
import bodyParser from "body-parser";
import path from "path";

import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
dotenv.config();

// App specific modules
import { REACT_URL, appName } from "./config.mjs";
import sessionRoutes from "./src/routes/sessionRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";
import miscRoutes from "./src/routes/miscRoutes.js";
import proxyHandler from './src/proxyHandler.js';

const app = express();
app.use(bodyParser.json());

// To use CloudFlare with POST requests we need to add the allowedOrigins to allow pre-flight requests (OPTIONS request) see
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/cors/#allow-preflighted-requests

let allowedOrigins = [REACT_URL];
allowedOrigins = allowedOrigins.map(o => {
  const url = new URL(o);
  return url.origin;
});
allowedOrigins.push("http://localhost:5000");
console.log("allowedOrigins", allowedOrigins);

app.use(
  cors({
    credentials: true,
    origin: function (origin, callback) {
      if (!origin) {
        // Allow requests without "Origin" header (such as img requests)
        callback(null, true);
      } else if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS origin is " + origin + " allowedOrigins ", allowedOrigins));
        console.log("Not allowed by CORS " + origin);
      }
    },
  })
);

app.use(express.json());

app.use('/processor', proxyHandler);

// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

app.use("/hub/api/session", sessionRoutes);
app.use("/hub/api/task", taskRoutes);
app.use("/hub/", miscRoutes); // After other routes because it has the default route

const serverOptions = {};
const server = http.createServer(serverOptions, app);
server.setTimeout(300000);

const port = process.env.WS_PORT || 5001;
server.listen(port, () => console.log(appName + " Task Hub started"));
