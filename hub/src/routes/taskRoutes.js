/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import { activeTasksStore_async, outputStore_async } from "../storage.mjs";
import { commandUpdate_async } from "../commandUpdate.mjs";
import { commandStart_async } from "../commandStart.mjs";
import { commandError_async } from "../commandError.mjs";
import { tasks } from "../configdata.mjs";
import { transferCommand, checkLockConflict, checkAPIRate, processError, processOutput_async } from "./taskProcessing.mjs";
import RequestError from './RequestError.mjs';

const router = express.Router();

async function processCommand_async(task, res) {
  const command = task.hub.command;
  switch (command) {
    case "start":
      return await commandStart_async(task, res);
    case "update":
      return await commandUpdate_async(task, res);
    case "error":
      return await commandError_async(task, res);
    default:
      throw new Error("Unknown command " + command);
  }
}

router.post("/", async (req, res) => {
  console.log(""); // Empty line
  console.log("/hub/api/task");
  let userId = utils.getUserId(req);
  if (userId) {
    let task = req.body.task;
    try {
      //console.log("req.body " + JSON.stringify(req.body))
      if (!task.processor) {
        throw new Error("Missing task.processor in /hub/api/task");
      }
      console.log("From processor " + task.processor.id);
      let activeTask = {};
      if (task.instanceId !== undefined) {
        activeTask = await activeTasksStore_async.get(task.instanceId);
      }
      const requestId = req.id;
      task = transferCommand(task, activeTask, requestId);
      task = checkLockConflict(task, activeTask);
      task = checkAPIRate(task, activeTask);
      task = processError(task, tasks);
      // Deep copy
      let error;
      if (task.error) {
        error = JSON.parse(JSON.stringify(task.error));
      }
      task = await processOutput_async(task, outputStore_async);
      const result = await processCommand_async(task, res);
      if (error !== undefined) {
        // Maybe throw from here ?
        console.log("Error in /hub/api/task " + error);
        res.status(500).json({ error: error });
      } else {
        res.status(200).json(result);
      }
    } catch (err) {
      if (err instanceof RequestError) {
        console.log("Error in /hub/api/task " + err.code + " " + err.message, err.origError);
        res.status(err.code).send(err.message);
      } else {
        console.log("Error in /hub/api/task " + err.message, task);
        throw err;
        res.status(500).json({ error: "Error in /hub/api/task " + err.message });
      }
    }
  } else {
    console.log("No user");
    res.status(500).json({ error: "No user" });
  }
});

export default router;