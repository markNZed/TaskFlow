/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import startTask_async from "../startTask.mjs";
import { activeTasksStore_async, outputStore_async, activeCoProcessors } from "../storage.mjs";
import { doneTask_async } from "../doneTask.mjs";
import { errorTask_async } from "../errorTask.mjs";
import { tasks } from "../configdata.mjs";
import syncTask_async from "../syncTask.mjs";
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
    console.log(task.hub.requestId + " start_async " + commandArgs.id + " from " + processorId);
    const initTask = {
      id: commandArgs.id,
      user: {id: task.user.id},
    };
    const prevInstanceId = commandArgs.prevInstanceId || task.instanceId;
    const coProcessorIds = Array.from(activeCoProcessors.keys());
    const coProcessing = coProcessorIds.length > 0;
    startTask_async(initTask, true, processorId, prevInstanceId)
      .then(async (startTask) => {
        if (coProcessing) {
          activeTasksStore_async.set(startTask.instanceId, startTask);
        }
        return startTask;
      })
      .then(async (startTask) => {
        //console.log("startTask",startTask)
        syncTask_async(startTask.instanceId, startTask);
        return startTask;
      })
      .then(async (startTask) => {
        if (!coProcessing) {
          activeTasksStore_async.set(startTask.instanceId, startTask);
        }
      })
  } catch (err) {
    console.log(`Error starting task ${commandArgs.id}`);
    throw new RequestError(`Error starting task ${task.id} ${err}`, 500, err);
  }
}

async function update_async(res, task) {
  try {
    const processorId = task.hub["sourceProcessorId"];
    if (task.instanceId === undefined) {
      throw new Error("Missing task.instanceId");
    }
    const activeTask = await activeTasksStore_async.get(task.instanceId)
    if (!activeTask) {
      throw new Error("No active task " + task.instanceId);
    }
    const commandArgs = task.hub["commandArgs"];
    if (commandArgs?.sync) {
      if (commandArgs?.done) {
        throw new Error("Not expecting sync of done task");
      }
      task = utils.deepMergeHub(activeTask, commandArgs.syncTask, task.hub);
    } else {
      task = utils.deepMergeHub(activeTask, task, task.hub);
    }
    console.log(task.meta.broadcastCount + " update_async " + task.id + " from " + processorId);
    // We intercept tasks that are done.
    if (commandArgs?.done) {
      console.log("Update task done " + task.id + " in state " + task.state?.current + " from " + processorId);
      await doneTask_async(task);
    } else {
      task.meta.updateCount = task.meta.updateCount + 1;
      console.log("Update task " + task.id + " in state " + task.state?.current + " from " + processorId);
      task.meta.hash = utils.taskHash(task);
      const coProcessorIds = Array.from(activeCoProcessors.keys());
      const coProcessing = coProcessorIds.length > 0;
        // Don't await so the HTTP response may get back before the websocket update
      syncTask_async(task.instanceId, task)
        .then(async (syncTask) => {
          if (!coProcessing) {
            activeTasksStore_async.set(syncTask.instanceId, syncTask);
          }
        })
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
    console.log(task.hub.requestId + " error_async " + task.id + " from " + processorId);
    await errorTask_async(task);
  } catch (error) {
    console.error(`Error in error_async task ${task.id}: ${error.message}`);
    throw new RequestError(`Error in error_async task ${task.id}: ${error.message}`, 500, error);
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