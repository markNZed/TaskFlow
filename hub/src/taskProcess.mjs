/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import RequestError from './routes/RequestError.mjs';
import { tasks } from "./configdata.mjs";
import { activeTasksStore_async, outputStore_async } from "./storage.mjs";
import { commandUpdate_async } from "./commandUpdate.mjs";
import { commandStart_async } from "./commandStart.mjs";
import { commandError_async } from "./commandError.mjs";

function transferCommand(task, activeTask, requestId) {
  const { command, id, coProcessorPosition, coProcessing, coProcessingDone  } = task.processor;
  // Could initiate from a processor before going through the coprocessor
  // Could be initiated by the coprocessor
  //console.log("task.processor.initiatingProcessorId ", task.processor.initiatingProcessorId);
  let initiatingProcessorId = task.processor.initiatingProcessorId || id;
  //console.log("initiatingProcessorId", initiatingProcessorId);
  if (!task.processor.isCoProcessor) {
    initiatingProcessorId = id;
  }
  //console.log("initiatingProcessorId", initiatingProcessorId);
  let commandArgs = {};
  if (task.processor.commandArgs) {
    commandArgs = JSON.parse(JSON.stringify(task.processor.commandArgs))
  }
  task.processor.command = null;
  task.processor.commandArgs = null;
  task.processor.coProcessorPosition = null;
  const activeTaskProcessors = activeTask?.processors || {};
  activeTaskProcessors[id] = JSON.parse(JSON.stringify(task.processor));
  task.processors = activeTaskProcessors;
  task.hub = {
    command,
    commandArgs,
    sourceProcessorId: id,
    initiatingProcessorId,
    requestId,
    coProcessorPosition,
    coProcessingDone,
    coProcessing,
  };
  //console.log("transferCommand " + command + " state " + task?.state?.current + " commandArgs ", commandArgs, " initiatingProcessorId " + initiatingProcessorId);
  return task;
}

function checkLockConflict(task, activeTask) {
  if (task.meta) {
    const lock = task.hub.commandArgs.lock || false;
    const unlock = task.hub.commandArgs.unlock || false;
    const lockBypass = task.hub.commandArgs.lockBypass || false;
    const lockProcessorId = task.hub.initiatingProcessorId;
    
    if (unlock) {
      task.meta.locked = null;
    }
    
    if (lock && activeTask && !activeTask.meta?.locked) {
      task.meta.locked = lockProcessorId;
      console.log("LOCKED ",task.id, task.meta.locked);
    } else if (activeTask && activeTask.meta?.locked && activeTask.meta.locked === lockProcessorId) {
      task.meta.locked = null;
    }
    
    if (activeTask && activeTask.meta?.locked && activeTask.meta.locked !== lockProcessorId && !lockBypass && !unlock) {
      const now = new Date();
      let updatedAt;
      if (task.meta.updatedAt) {
        updatedAt = new Date(task.meta.updatedAt.date);
      }
      
      const differenceInMinutes = (now - updatedAt) / 1000 / 60;
      
      if (differenceInMinutes > 5 || updatedAt === undefined) {
        console.log(`Task lock expired for ${lockProcessorId} locked by ${activeTask.meta.locked}`);
      } else {
        console.log(`Task lock conflict with ${lockProcessorId} command ${task.hub.command} locked by ${activeTask.meta.locked} ${differenceInMinutes} minutes ago.`);
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

    const maxRequestCount = task?.config?.maxRequestCount;
    if (maxRequestCount && task.meta.requestCount > maxRequestCount) {
      console.log(`Task request count: ${task.meta.requestCount} of ${maxRequestCount}`);
      task.error = {message: "Task request count of " + maxRequestCount + " exceeded."};
      //throw new RequestError("Task request count exceeded", 409);
    }
    //console.log(`Task request count: ${task.meta.requestCount} of ${maxRequestCount}`);
    task.meta.requestCount++;
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
      return await commandStart_async(task, res);
    case "update":
      return await commandUpdate_async(task, res);
    case "error":
      return await commandError_async(task, res);
    default:
      throw new Error("Unknown command " + command);
  }
}

async function taskProcess_async(task, req, res) {
  try {
    if (!task.processor) {
      throw new Error("Missing task.processor in /hub/api/task");
    }
    console.log("From processor " + task.processor.id);
    let activeTask = {};
    if (task.instanceId !== undefined) {
      activeTask = await activeTasksStore_async.get(task.instanceId);
      activeTask.hub["hashTask"] = JSON.parse(JSON.stringify(activeTask)); // deep copy to avoid self-reference
    }
    let requestId;
    if (req) {
      requestId = req.id;
    }
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
    if (res) {
      const result = await processCommand_async(task, res);
      if (error !== undefined) {
        // Maybe throw from here ?
        console.log("Error in /hub/api/task " + error);
        if (res) {
          res.status(500).json({ error: error });
        }
      } else {
        if (res) {
          res.status(200).json(result);
        }
      }
    }
  } catch (err) {
    if (err instanceof RequestError) {
      console.log("Error in /hub/api/task " + err.code + " " + err.message, err.origError);
      if (res) {
        res.status(err.code).send(err.message);
      }
    } else {
      console.log("Error in /hub/api/task " + err.message, task);
      throw err;
      if (res) {
        res.status(500).json({ error: "Error in /hub/api/task " + err.message });
      }
    }
  }
  return task;
}

export { taskProcess_async }