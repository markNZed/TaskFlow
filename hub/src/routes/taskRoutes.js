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
import { errorTask_async } from "../errorTask.mjs";
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
    const lock = task.hub.commandArgs.lock || false;
    const unlock = task.hub.commandArgs.unlock || false;
    const lockBypass = task.hub.commandArgs.lockBypass || false;
    const processorId = task.hub.sourceProcessorId;
    
    if (unlock) {
      task.meta.locked = null;
    }
    
    if (lock && activeTask && !activeTask.meta.locked) {
      task.meta.locked = processorId;
    } else if (activeTask && activeTask.meta.locked && activeTask.meta.locked === processorId) {
      task.meta.locked = null;
    }
    
    if (activeTask && activeTask.meta.locked && activeTask.meta.locked !== processorId && !lockBypass && !unlock) {
      const now = new Date();
      let updatedAt;
      if (task.meta.updatedAt) {
        updatedAt = new Date(task.meta.updatedAt.date);
      }
      
      const differenceInMinutes = (now - updatedAt) / 1000 / 60;
      
      if (differenceInMinutes > 5 || updatedAt === undefined) {
        console.log(`Task lock expired for ${processorId} locked by ${activeTask.meta.locked}`);
      } else {
        console.log(`Task lock conflict with ${processorId} locked by ${activeTask.meta.locked} ${differenceInMinutes} minutes ago.`);
        throw new RequestError("Task locked", 423);
      }
    }
  }
  
  return task;
}

function checkAPIRate(task, activeTask) {
  if (task.meta) {
    const currentDate = new Date();
    const resetDate = new Date(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
      currentDate.getUTCHours(),
      currentDate.getUTCMinutes()
    );

    const maxRequestRate = task?.config?.maxRequestRate ?? 0;
    if (maxRequestRate && task.meta.updatedAt) {
      const updatedAt = new Date(task.meta.updatedAt.date);

      if (updatedAt >= resetDate) {
        if (task.meta.requestsThisMinute >= maxRequestRate) {
          throw new RequestError(
            `Task update rate exceeded ${maxRequestRate} per minute`,
            409
          );
        }
      } else {
        task.meta.requestsThisMinute = 0;
      }

      task.meta.requestsThisMinute++;
    }

    const maxRequestCount = task?.config?.maxRequestCount ?? 0;
    if (maxRequestCount && task.meta.maxRequestCount > maxRequestCount) {
      throw new RequestError("Task request count exceeded", 409);
    }
  }

  return task;
}

function findClosestErrorTask(taskId, tasks) {
  const taskLevels = taskId.split('.');
  for (let i = taskLevels.length - 1; i >= 0; i--) {
    taskLevels[i] = "error";
    const errorTaskId = taskLevels.join('.');
    if (tasks[errorTaskId]) {
      return errorTaskId;
    }
    taskLevels.splice(i, 1);
  }
  return null;
}

function processError(task, tasks) {
  if (task.error) {
    let errorTask;
    if (task.config && task.config.errorTask) {
      errorTask = task.config.errorTask;
    } else {
      errorTask = findClosestErrorTask(task.id, tasks);
    }
    task.hub.command = "error";
    task.hub.commandArgs = { errorTask };
  }
  return task;
}

async function processOutput_async(task, outputStore) {
  if (task.output) {
    let output = await outputStore.get(task.familyId);
    if (!output) {
      output = {};
    }
    output[`${task.id}.output`] = task.output;
    await outputStore.set(task.familyId, output);
  }
  return task;
}

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
    console.log("start_async " + task.id + " from " + processorId);
    const initTask = {
      id: commandArgs.id,
      userId: task.userId,
    };
    const prevInstanceId = commandArgs.prevInstanceId || task.instanceId;
    await startTask_async(initTask, true, processorId, prevInstanceId);
    res.status(200).send("ok");
  } catch (err) {
    console.log(`Error starting task ${task.id} ${err}`);
    throw new RequestError(`Error starting task ${task.id} ${err}`, 500);
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
      res.status(200).send("ok");
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
    throw new RequestError(`Error updating task ${task.id}: ${error.message}`, 500);
  }
}

async function error_async(res, task) {
  try {
    const processorId = task.hub["sourceProcessorId"];
    console.log("error_async " + task.id + " from " + processorId);
    await errorTask_async(task);
    res.status(200).send("ok");
  } catch (error) {
    console.error(`Error in error_async task ${task.id}: ${error.message}`);
    throw new RequestError(`Error in error_async task ${task.id}: ${error.message}`, 500);
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
        res.status(err.code).send(err.message);
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