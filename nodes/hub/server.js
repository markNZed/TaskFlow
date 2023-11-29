/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// 3rd party modules
import express from "express";
import requestId from 'express-request-id';
import cors from "cors";
import http from "http";
import bodyParser from "body-parser";
import path from "path";
import cookieParser from 'cookie-parser';

import { fileURLToPath, URL } from "url";
import * as dotenv from "dotenv";
dotenv.config();

// App specific modules
import { NODE, NODETribe } from "./config.mjs";
import miscRoutes from "./src/routes/miscRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import loginRoutes from "./src/routes/loginRoutes.js";
import { initWebSocketServer } from "./src/webSocket.js";
import { tribesStore_async } from "./src/storage.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, res, next) => {
  let size = 0;
  req.on('data', chunk => {
    size += chunk.length;
  });
  req.on('end', () => {
    console.log(`Request size in bytes: ${size}`);
  });
  next();
});

app.use(requestId());
app.use(bodyParser.json());
app.use(cookieParser());

// To use CloudFlare with POST requests we need to add the allowedOrigins to allow pre-flight requests (OPTIONS request) see
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/cors/#allow-preflighted-requests

let allowedOrigins = [];
if (NODE.allowedOrigins) {
  allowedOrigins = NODE.allowedOrigins.split(',');
}
allowedOrigins = allowedOrigins.map(o => {
  const url = new URL(o);
  return url.origin;
});
allowedOrigins.push("http://localhost:5000");
allowedOrigins.push("http://localhost:3000");
console.log("allowedOrigins", allowedOrigins);

app.use(
  cors({
    credentials: true,
    origin: function (origin, callback) {
      if (!origin) {
        // Allow requests without "Origin" header (such as img requests)
        callback(null, true);
        //console.log("Server found no origin", origin);
      } else if (allowedOrigins.indexOf(origin) !== -1) {
        //console.log("Server found origin", origin);
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS origin is " + origin + " allowedOrigins ", allowedOrigins));
        console.log("Not allowed by CORS " + origin);
      }
    },
  })
);

app.use(async (req, res, next) => {
  // Using host not origin because origin may not be set by client and host is set by proxy
  // This is primarily for the login.html route 
  //console.log("req.headers",req.headers, );
  const referer = req?.headers?.referer;
  if (referer) {
    const url = new URL(referer);
    const host = url.host;
    // This is not yet implemented on the websocket
    // nginx upgrades the HTTP request to a websocket request
    // We are then using the origin header to find the tribe, we would need to modify
    // the websocket to allow for a tribe to be passed (maybe using URL query param also)
    const searchParamTribe = url.searchParams.get("tribeId");
    const tribeId = searchParamTribe || host;
    const tribe = await tribesStore_async.get(tribeId);
    console.log("Server found host", host, "searchParam", url.searchParams.get("tribeId"), "tribeId", tribeId);
    // Allows us to override NODE settings based on Tribe
    if (tribe) {
      if (tribe.NODE) {
        NODETribe(tribe);
        req.tribeId = tribeId;
        //console.log("Server found tribe", tribe);
      } else {
        console.log("Server could not find tribe.NODE for", tribe);
      }
    } else {
      console.log("Server could not find tribe", tribeId);
    }
  }
  next();
});

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

app.use(express.json());

// Set the view engine to ejs
app.set('view engine', 'ejs');
// Set the views directory
const viewsDir = path.join(__dirname, 'views');
app.set('views', viewsDir);
console.log("Views dir:", viewsDir)

// Route to serve the login.html file when /login.html is accessed
app.get('/login.html', (req, res) => {
  console.log("Serving login.html appName",NODE.app.label);
  res.render('login', { appName: NODE.app.label });
});
// Route to serve the login.html file when /login.html is accessed
// Will need to add the route for this to work
app.get('/logout.html', (req, res) => {
  console.log("Serving logout.html appName",NODE.app.label);
  res.render('logout', { appName: NODE.app.label });
});

app.use("/auth", authRoutes);
app.use("/login", loginRoutes);
app.use("/", miscRoutes); // After other routes because it has the default route

// Serve static files from the public directory after ejs rendering
app.use(express.static(path.join(__dirname, "public")));

// Catch-all route for handling unknown endpoints
app.use('*', (req, res) => {
  res.status(404).send('404 Not Found');
  // Or if you have a 404.html or 404.ejs page, you can render it
  // res.status(404).render('404');
});

// Error handling middleware at the end
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const serverOptions = {};
const server = http.createServer(serverOptions, app);
server.setTimeout(300000);

initWebSocketServer(server);

const port = process.env.WS_PORT || 5001;
server.listen(port, () => console.log(NODE.app.name + " Hub started on port " + port));
