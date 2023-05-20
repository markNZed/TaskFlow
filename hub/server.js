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
import { REACT_URL, NODEJS_URL, appName } from "./config.mjs";
import sessionRoutes from "./src/routes/sessionRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";
import miscRoutes from "./src/routes/miscRoutes.js";
import { proxyHandler } from './src/proxyHandler.js';
import { initWebSocketProxy } from "./src/websocket.js";

import { utils } from "./src/utils.mjs";
import { instancesStore_async } from "./src/storage.mjs";
import newTask_async from "./src/newTask.mjs";
import updateTask_async from "./src/updateTask.mjs";
import { processors, tasktemplates } from "./src/configdata.mjs";

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

//app.use('/hub/processor', proxyHandler);
app.use('/hub/processor', async (req, res, next) => {
  console.log('/hub/processor');
  if (!req.body) {
    console.log('/hub/processor: no body');
    next()
  }
  let originalBody = req.body;
  let task = originalBody.task;
  let userId = utils.getUserId(req);
  if (task.state?.done) {
    console.log("Task done through proxy " + task.id);
    task.state.done = false;
    await instancesStore_async.set(task.instanceId, task);
    // Fetch from the Task Hub
    let newTask = await newTask_async(task.nextTask, userId, false, task.source, task.sessionId, task?.groupId, task.stackPtr, task.nextTask, task);
    // What is the active tasktemplate?
    const tasktemplateName = newTask.stack[newTask.stackPtr - 1]
    //console.log("tasktemplateName", tasktemplateName);
    const tasktemplate = tasktemplates["root." + tasktemplateName]
    //console.log("tasktemplate", tasktemplate);
    const environments = tasktemplate.environments;
    // Need to deal with multiple environments.
    // If the task.source is not in the environments array then we need to send the task to the relevant processor.
    //console.log("environments", environments);
    //console.log("task.source", task.source);
    if (environments.indexOf(task.source) !== -1) {
      // The source is in the environments array so we can just return.
      console.log("Remember to deal with multiple environments")
      res.json({task: newTask});
      return;
    } else if (environments.length === 1) {
      // The desired environment
      const environment = environments[0];
      // Assuming there is one processor for each environment
      const processor = processors["root." + environment];
      //console.log("processor", processor);
      // send the task to the correct processor
      if (environment === "nodejs") {
        newTask.destination = processor.url + "/api/task/update";
        //console.log("newTask", newTask)
        newTask = await updateTask_async(newTask)
        res.json({task: newTask});
        return;
      } else {
        console.log("Need to deal with other environments than nodejs " + environment);
      }
    } else {
      console.log("Need to deal with multiple environments")
    }
    console.log("Should not be here");
    res.json({task: newTask});
  } else {
    console.log('proxyHandler next');
    next();
  }
}, proxyHandler);

// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

app.use("/hub/api/session", sessionRoutes);
app.use("/hub/api/task", taskRoutes);
app.use("/", miscRoutes); // After other routes because it has the default route

const serverOptions = {};
const server = http.createServer(serverOptions, app);
server.setTimeout(300000);

initWebSocketProxy(server);

const port = process.env.WS_PORT || 5001;
server.listen(port, () => console.log(appName + " Task Hub started"));
