/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import startTask_async from "../startTask.mjs";
import { activeTasksStore_async, outputStore_async } from "../storage.mjs";
import { doneTask_async } from "../doneTask.mjs";
import { errorTask_async } from "../errorTask.mjs";
import { tasks } from "../configdata.mjs";
import { transferCommand, checkLockConflict, checkAPIRate, processError, processOutput_async } from "./taskProcessing.mjs";
import RequestError from './RequestError.mjs';

const router = express.Router();

async function processCommand_async(task, res) {
  const command = task.hub.command;
  switch (command) {
    case "start":
      return await start_async(res, task);
    case "update":
      return await update_async(res, task);
    case "error":
      return await error_async(res, task);
    default:
      throw new Error("Unknown command " + command);
  }
}

async function start_async(res, task) {
  const commandArgs = task.hub.commandArgs;
  const processorId = task.hub.sourceProcessorId;
  try {
    console.log("start_async " + commandArgs.id + " from " + processorId);
    const initTask = {
      id: commandArgs.id,
      userId: task.userId,
    };
    const prevInstanceId = commandArgs.prevInstanceId || task.instanceId;
    await startTask_async(initTask, true, processorId, prevInstanceId);
  } catch (err) {
    console.log(`Error starting task ${commandArgs.id}`);
    throw new RequestError(`Error starting task ${task.id} ${err}`, 500, err);
  }
}

async function update_async(res, task) {
  try {
    const processorId = task.hub["sourceProcessorId"];
    console.log("update_async " + task.id + " from " + processorId);
    const commandArgs = task.hub["commandArgs"];

    // We intercept tasks that are done.
    if (commandArgs?.done) {
      console.log("Update task done " + task.id + " in state " + task.state?.current + " from " + processorId);
      await doneTask_async(task);
    } else {
      console.log("Update task " + task.id + " in state " + task.state?.current + " from " + processorId);
      task.meta.updateCount = task.meta.updateCount + 1;

      // Don't await so the return gets back before the websocket update
      // Middleware will send the update via websocket
      activeTasksStore_async.set(task.instanceId, task);
      
      // So we do not return a task anymore. This requires the task synchronization working.
      res.status(200).send("ok");
    }
  } catch (error) {
    console.error(`Error updating task ${task.id}: ${error.message}`);
    throw new RequestError(`Error updating task ${task.id}: ${error.message}`, 500, error);
  }
}

async function error_async(res, task) {
  try {
    const processorId = task.hub["sourceProcessorId"];
    console.log("error_async " + task.id + " from " + processorId);
    await errorTask_async(task);
  } catch (error) {
    console.error(`Error in error_async task ${task.id}: ${error.message}`);
    throw new RequestError(`Error in error_async task ${task.id}: ${error.message}`, 500, error);
  }
}

router.post("/", async (req, res) => {
  console.log("/hub/api/task");
  let userId = utils.getUserId(req);
  if (userId) {
    let task = req.body.task;
    try {
      //console.log("req.body " + JSON.stringify(req.body))
      if (!task.processor) {
        throw new Error("Missing task.processor in /hub/api/task");
      }
      let activeTask = {};
      if (task.instanceId !== undefined) {
        activeTask = await activeTasksStore_async.get(task.instanceId);
      }
      task = transferCommand(task, activeTask);
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