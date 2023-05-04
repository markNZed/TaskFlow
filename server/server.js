/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// If the module is exporting a named export, use curly braces to destructure the named export.
// If the module is exporting a default export, import it directly without using curly braces.

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
import { CLIENT_URL } from "./config.mjs";
import sessionRoutes from "./routes/sessionRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import miscRoutes from "./routes/miscRoutes.js";
import { initWebSocketServer } from "./src/websocket.js";

// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

// To use CloudFlare with POST requests we need to add the allowedOrigins to allow pre-flight requests (OPTIONS request) see
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/cors/#allow-preflighted-requests

const allowedOrigins = [CLIENT_URL];

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
        callback(new Error("Not allowed by CORS " + origin));
        console.log("Not allowed by CORS " + origin);
      }
    },
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/session", sessionRoutes);
app.use("/api/task", taskRoutes);
app.use("/", miscRoutes); // After other routes because it has the default route

const serverOptions = {};
const server = http.createServer(serverOptions, app);

initWebSocketServer(server);

const port = process.env.WS_PORT || 5000;
server.listen(port, () => console.log("Chat2Flow server started"));
