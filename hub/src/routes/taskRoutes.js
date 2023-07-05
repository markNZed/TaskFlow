/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import startTask_async from "../startTask.mjs";
import { activeTasksStore_async, outputStore_async } from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { doneTask_async } from "../doneTask.mjs";
import { tasks } from "../configdata.mjs";

const router = express.Router();

function transferCommand(task, activeTask) {
  const { command, commandArgs, id } = task.processor;
  task.processor.command = null;
  task.processor.commandArgs = null;
  const activeTaskProcessor = activeTask?.processor || {};
  activeTaskProcessor[id] = JSON.parse(JSON.stringify(task.processor));
  task.processor = activeTaskProcessor;
  task.hub = {
    command,
    commandArgs: JSON.parse(JSON.stringify(commandArgs)),
    sourceProcessorId: id,
  };
  return task;
}

class RequestError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

function checkLockConflict(task, activeTask) {
  if (task.meta) {
    let lock = task.hub.commandArgs.lock || false;
    let unlock = task.hub.commandArgs.unlock || false;
    let lockBypass = task.hub.commandArgs.lockBypass || false;
    const processorId = task.hub["sourceProcessorId"];
    // Check if the task is locked
    if (unlock) {
      task.meta["locked"] = null;
      console.log("Task forced unlock by " + processorId);
    }
    if (lock) {
      if (activeTask && !activeTask.meta.locked) {
        console.log("Task locked by " + processorId);
        task.meta["locked"] = processorId;
      }
    } else if (activeTask && activeTask.meta.locked && activeTask.meta.locked === processorId) {
      console.log("Task unlocked by " + processorId);
      task.meta.locked = null;
    }
    if (
      activeTask && 
      activeTask.meta.locked && 
      activeTask.meta.locked !== processorId && 
      !lockBypass &&!unlock
    ) {
      let now = new Date(); // Current time
      let updatedAt;
      if (task.meta.updatedAt) {
        updatedAt = new Date(task.meta.updatedAt.date); 
      }
      // Get the difference in minutes
      let differenceInMinutes = (now - updatedAt) / 1000 / 60;
      console.log("differenceInMinutes", differenceInMinutes)
      if (differenceInMinutes > 5 || updatedAt === undefined) {
        console.log("Task lock expired for " + processorId + " locked by " + activeTask.meta.locked)
      } else {
        console.log("Task lock conflict with " + processorId + " locked by " + activeTask.meta.locked + " " + differenceInMinutes + " minutes ago.")
        throw new RequestError("Task locked", 423);
      } 
    }
  }
  return task;
}

function checkAPIRate(task, activeTask) {
  if (task.meta) {  // Control API rate
    const currentDate = new Date(); // Will be local time
    const resetDate = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), currentDate.getUTCHours(), currentDate.getUTCMinutes());
    // If task has been updated before
    const maxRequestRate = task?.config?.maxRequestRate; // per minute
    if (maxRequestRate && task.meta.updatedAt) {
      const updatedAt = new Date(task.meta.updatedAt.date);
      // If the last update happened within the current minute
      if (updatedAt >= resetDate) {
        // If updates this minute is more than the max rate, cannot update
        if (task.meta.requestsThisMinute >= maxRequestRate) {
          throw new RequestError("Task update rate exceeded " + maxRequestRate + " per minute", 409);
        }
      } else {
        // If the last update was not in the current minute, reset the counter
        //console.log("task.meta.requestsThisMinute = 0")
        task.meta.requestsThisMinute = 0;
      }
      task.meta.requestsThisMinute++;
    }
    const maxRequestCount = task?.config?.maxRequestCount;
    if (maxRequestCount && task.meta.maxRequestCount > maxRequestCount) {
      throw new RequestError("Task request count exceeded", 409);
    }
  }
  return task;
}

function findClosestErrorTask(taskId, tasks) {
  const strArr = taskId.split('.');
  for (let i = strArr.length - 1; i >= 0; i--) {
      strArr[i] = "error";
      const errorTaskId = strArr.join('.');
      if (tasks[errorTaskId]) {
          return errorTaskId;
      }
      strArr.splice(i, 1); // If this level doesn't exist, remove it
  }
  return null; // Return null if no error task found
}

function processError(task, tasks) {
  // Catch errors
  if (task.error) {
    let errorTask
    if (task.config?.errorTask) {
      errorTask = task.config.errorTask
    } else {
      errorTask = findClosestErrorTask(task.id, tasks);
      console.log("Found errorTask " + errorTask);
    }
    // We are not using errorTask yet
    task.hub["command"] = "error";
    task.hub["commandArgs"] = {"errorTask": errorTask, "done": true};
    console.log("Task error " + task.id);
  }
  return task;
}

async function processOutput_async(task, outputStore_async) {
  if (task.output) {
    let output = await outputStore_async.get(task.familyId);
    if (!output) {
      output = {};
    }
    output[task.id + ".output"] = task.output;
    //console.log("Output " + task.id + ".output" + " " + task.output)
    await outputStore_async.set(task.familyId, output);
  }
  return task;
}

async function processCommand_async(task, res) {
  // Switch to function based on task.hub["command"]
  switch (task.hub["command"]) {
    case "start":
      return await start_async(res, task)
    case "update":
      return await update_async(res, task)
    case "error":
      return await error_async(res, task)
    default:
      throw new Error("Unknown command " + task.hub["command"]);
  }
}

async function start_async(res, task) {
  //console.log("start_async task", task);
  const commandArgs = task.hub["commandArgs"];
  const processorId = task.hub["sourceProcessorId"];
  try {
    console.log("start_async " + commandArgs.id + " by " + task.id);
    const initTask = {
      id: commandArgs.id,
      userId: task.userId,
    }
    let prevInstanceId;
    if (commandArgs.prevInstanceId) {
      prevInstanceId = commandArgs.prevInstanceId;
    } else {
      prevInstanceId = task.instanceId;
    }
    // Just set initial task values and pass that in instead of a long list of arguments?
    await startTask_async(initTask, true, processorId, prevInstanceId);
    res.status(200).send("ok");
  } catch (err) {
    //throw err;
    console.log("Error starting task " + task.id + " " + err);
    res.status(500).json({ error: "Error starting task " + task.id + " " + err });
  }
}

async function update_async(res, task) {
  console.log("update_async " + task.id);
  const commandArgs = task.hub["commandArgs"];
  const processorId = task.hub["sourceProcessorId"];
  // We intercept tasks that are done.
  if (commandArgs?.done) {
    doneTask_async(task) 
    return res.status(200).send("ok");
  // Pass on tasks that are not done
  } else {
    console.log("Update task " + task.id + " in state " + task.state?.current + " from " + processorId)
    task.meta.updateCount = task.meta.updateCount + 1;
    // Don't await so the return gets back before the websocket update
    // Middleware will send the update
    activeTasksStore_async.set(task.instanceId, task);
    // So we do not return a task anymore. This requires the task synchronization working.
    res.status(200).send("ok");
  }
}

async function error_async(res, task) {
  console.log("error_async " + task.id);
  const commandArgs = task.hub["commandArgs"];
  const processorId = task.hub["sourceProcessorId"];
  // We intercept tasks that are done.
  if (commandArgs?.done) {
    doneTask_async(task) 
    return res.status(200).send("ok");
  // Pass on tasks that are not done
  } else {
    console.log("Error in task " + task.id + " in state " + task.state?.current + " from " + processorId + " error Task returned " + commandArgs.errorTask)
    task.meta.updateCount = task.meta.updateCount + 1;
    // Don't await so the return gets back before the websocket update
    // Middleware will send the update
    activeTasksStore_async.set(task.instanceId, task);
    // So we do not return a task anymore. This requires the task synchronization working.
    res.status(200).send("ok");
  }
}

router.post("/", async (req, res) => {
  console.log("/hub/api/task");
  let userId = utils.getUserId(req);
  if (userId) {
    try {
      //console.log("req.body " + JSON.stringify(req.body))
      let task = req.body.task;
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
      task = await processOutput_async(task, outputStore_async);
      const result = await processCommand_async(task, res);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof RequestError) {
        res.status(error.code).send(error.message);
      } else {
        console.log("Error in /hub/api/task " + err.message);
        res.status(500).json({ error: "Error in /hub/api/task " + err.message });
      }
    }
  } else {
    console.log("No user");
    res.status(500).json({ error: "No user" });
  }
});

export default router;


