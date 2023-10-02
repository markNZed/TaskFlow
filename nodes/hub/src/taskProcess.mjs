/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import RequestError from './routes/RequestError.mjs';
import { getActiveTask_async, setActiveTask_async, outputStore_async, tasksStore_async, usersStore_async } from "./storage.mjs";
import { utils } from './utils.mjs';
import taskSync_async from "./taskSync.mjs";
import { haveCoprocessor } from "../config.mjs";
// eslint-disable-next-line no-unused-vars
import assert from 'assert';
import _ from "lodash";
import { taskLock } from './shared/taskLock.mjs';

// Could try to detect error cycles
const maxErrorRate = 20; // per minute
let lastErrorDate;
let errorCountThisMinute = 0;

function hubAssertions(taskDiff, mergedTask) {
  // Here taskDiff is the task we receive from the processor but with task.meta.modified added
  if (taskDiff?.state?.current && mergedTask?.state?.legal) {
    utils.assertWarning(mergedTask.state.legal.includes(taskDiff.state.current), `unexpected state:${taskDiff.state.current} instanceId:${mergedTask.instanceId}`);
  }
  const request = mergedTask?.meta?.modified?.request;
  const response = mergedTask?.meta?.modified?.response;
  utils.assertWarning(!(!_.isEmpty(request) && !_.isEmpty(response)), `Should have either response or request not both response: ${response} request:${request}`);
}

async function processorInHubOut_async(task, activeTask, requestId) {
  utils.debugTask(task);
  const { command, id, coprocessingPosition, coprocessing, coprocessingDone, statesSupported, statesNotSupported } = task.processor;
  // Could initiate from a processor before going through the coprocessor
  // Could be initiated by the coprocessor
  //utils.logTask(task, "task.processor.initiatingProcessorId ", task.processor.initiatingProcessorId);
  let initiatingProcessorId = task.processor.initiatingProcessorId || id;
  //utils.logTask(task, "initiatingProcessorId", initiatingProcessorId);
  if (!task.processor.isCoprocessor) {
    initiatingProcessorId = id;
  }
  //utils.logTask(task, "initiatingProcessorId", initiatingProcessorId);
  let commandArgs = {};
  if (task.processor.commandArgs) {
    commandArgs = utils.deepClone(task.processor.commandArgs);
  }
  let commandDescription = "";
  if (task.processor.commandDescription) {
    commandDescription = task.processor.commandDescription;
  }
  task.processor.command = null;
  task.processor.commandArgs = null;
  task.processor.coprocessing = null;
  task.processor.coprocessingDone = null;
  task.processor.coprocessingPosition = null;
  const activeTaskProcessors = activeTask?.processors || {};
  const processor = utils.deepClone(task.processor);
  if (!activeTaskProcessors[id]) {
    activeTaskProcessors[id] = processor;
  } else {
    activeTaskProcessors[id] = utils.deepMerge(activeTaskProcessors[id], processor);
  }
  task.processors = activeTaskProcessors;
  /*
  // For each processor in task.processors log the stateLast
  for (const key in task.processors) {
    const processor = task.processors[key];
    console.log(`Processor: ${key}, StateLast: ${processor.stateLast}`);
  }
  */
  task.users = activeTask?.users || {};
  // This allows us to incorporate admin changes to user
  if (task?.user?.id) {
    const user = await usersStore_async.get(task.user.id);
    task.users[task.user.id] = user;
  }

  task.hub = {
    command,
    commandArgs,
    commandDescription,
    sourceProcessorId: id,
    initiatingProcessorId,
    requestId,
    coprocessingPosition,
    coprocessingDone,
    coprocessing,
    statesSupported,
    statesNotSupported,
  };
  utils.logTask(task, "processorToHub " + command + " state " + task?.state?.current + " commandArgs ", commandArgs, " initiatingProcessorId " + initiatingProcessorId);
  return task;
}

function checkLockConflict(task, activeTask) {
  utils.debugTask(task);
  if (task.meta) {
    const lock = task.hub.commandArgs.lock || false;
    const unlock = task.hub.commandArgs.unlock || false;
    const lockBypass = task.hub.commandArgs.lockBypass || false;
    const lockProcessorId = task.hub.initiatingProcessorId;
    
    if (lock && activeTask && !activeTask.meta?.locked) {
      task.meta.locked = lockProcessorId;
      utils.logTask(task, "LOCKED ",task.id, task.meta.locked);
    } else if (unlock) {
      task.meta.locked = null;
      utils.logTask(task, "UNLOCK explicit",task.id, task.meta.locked);
    } else if (activeTask && activeTask.meta?.locked && activeTask.meta.locked === lockProcessorId) {
      task.meta.locked = null;
      utils.logTask(task, "UNLOCK implicit",task.id, task.meta.locked);
    }
    
    if (activeTask && activeTask.meta?.locked && activeTask.meta.locked !== lockProcessorId && !lockBypass && !unlock) {
      const now = new Date();
      let localUpdatedAt;
      if (task.meta.updatedAt) {
        localUpdatedAt = new Date(task.meta.updatedAt.date);
      }
      
      const differenceInMinutes = (now - localUpdatedAt) / 1000 / 60;
      
      if (differenceInMinutes > 5 || localUpdatedAt === undefined) {
        utils.logTask(task, `UNLOCK task lock expired for ${lockProcessorId} locked by ${activeTask.meta.locked} localUpdatedAt ${localUpdatedAt}`);
      } else {
        utils.logTask(task, `CONFLICT Task lock conflict with ${lockProcessorId} command ${task.hub.command} locked by ${activeTask.meta.locked} ${differenceInMinutes} minutes ago.`);
        throw new RequestError("Task locked", 423);
      }
    }
  }
  
  return task;
}

function checkAPIRate(task) {
  utils.debugTask(task);
  const maxRequestRate = task?.config?.maxRequestRate ?? 0; 
  if (maxRequestRate && task?.meta?.lastUpdatedAt) {
    const lastUpdatedAt = new Date(task.meta.lastUpdatedAt.date);
    const updatedAt = new Date(task.meta.updatedAt.date);

    if (lastUpdatedAt.getUTCMinutes() !== updatedAt.getUTCMinutes()) {
      //console.log("checkAPIRate", lastUpdatedAt.getUTCMinutes(), updatedAt.getUTCMinutes())
      task.meta.requestsThisMinute = 0;
    } else {
      task.meta.requestsThisMinute++;
      //console.log("checkAPIRate requestsThisMinute", task.meta.requestsThisMinute);
    }

    if (task.meta.requestsThisMinute >= maxRequestRate) {
      task.error = {message: `Task update rate exceeded ${maxRequestRate} per minute`};
    }

    const maxRequestCount = task?.config?.maxRequestCount;
    if (maxRequestCount && task.meta.requestCount > maxRequestCount) {
      utils.logTask(task, `Task request count: ${task.meta.requestCount} of ${maxRequestCount}`);
      task.error = {message: "Task request count of " + maxRequestCount + " exceeded."};
    }
    //utils.logTask(task, `Task request count: ${task.meta.requestCount} of ${maxRequestCount}`);
    task.meta.requestCount++;
  }
  return task;
}

function checkErrorRate(task) {
  utils.debugTask(task);
  if (task.error || task?.hub?.command === "error" || (task.id && task.id.endsWith(".error"))) {
    //console.log("checkErrorRate errorCountThisMinute:", errorCountThisMinute, "lastErrorDate:", lastErrorDate, "task.error:", task.error);
    const currentDate = new Date();
    const resetDate = new Date(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
      currentDate.getUTCHours(),
      currentDate.getUTCMinutes()
    );
    const maxRequestRate = maxErrorRate ?? 0;
    if (maxRequestRate) {
      if (lastErrorDate && resetDate > lastErrorDate) {
        errorCountThisMinute = 0;
      }
      errorCountThisMinute++;
      lastErrorDate = resetDate;
      if (errorCountThisMinute > maxRequestRate) {
        throw new Error(`Hub error rate exceeded ${maxRequestRate} per minute`);
      }
    }
  }
}


async function findClosestErrorTask_async(taskId, tasksStore_async) {
  const taskLevels = taskId.split('.');
  for (let i = taskLevels.length - 1; i >= 0; i--) {
    taskLevels[i] = "error";
    const errorTaskId = taskLevels.join('.');
    if (await tasksStore_async.get(errorTaskId)) {
      return errorTaskId;
    }
    taskLevels.splice(i, 1);
  }
  return null;
}

async function processError_async(task, tasksStore_async) {
  utils.debugTask(task);
  if (task.error) {
    let errorTask;
    if (task.config && task.config.errorTask) {
      errorTask = task.config.errorTask;
    } else {
      errorTask = await findClosestErrorTask_async(task.id, tasksStore_async);
    }
    task.hub.command = "error";
    task.hub.commandArgs = { errorTask };
  }
  return task;
}

async function processOutput_async(task, outputStore) {
  utils.debugTask(task);
  // Check task.output is not empty as empty will override via deepMerge
  if (task.output && Object.keys(task.output).length > 0) {
    let output = await outputStore.get(task.familyId);
    if (!output) {
      output = {};
    }
    // Merge because we are receiving a diff
    output[`${task.id}.output`] = utils.deepMerge(output[`${task.id}.output`], task.output);
    await outputStore.set(task.familyId, output);
  }
  return task;
}

async function taskProcess_async(task, req) {
  try {
    if (!task.processor) {
      throw new Error("Missing task.processor in /hub/api/task");
    }
    utils.logTask(task, "From processor:" + task.processor.id + " command:" + task.processor.command + " commandDescription:" + task.processor.commandDescription + " state:" + task?.state?.current);
    let activeTask = {};

    utils.debugTask(task);
    checkErrorRate(task);
    if (task.processor.command === "update") {
      task = utils.setMetaModified(task);
      //console.log("taskProcess_async setMetaModified", JSON.stringify(task.meta.modified, null, 2));
    }
    if (task.instanceId !== undefined) {
      activeTask = await getActiveTask_async(task.instanceId);
      if (activeTask && Object.keys(activeTask).length !== 0) {
        if (task.meta?.hashDiff) {
          // This is running on "partial" which seems a waste
          utils.checkHashDiff(activeTask, task);
        }
        // Need to restore meta for checkLockConflict, checkAPIRate
        // Need to restore config for checkAPIRate
        const taskDiff = utils.deepClone(task);
        // We want to use the processor as sent in
        // For example sync may not set all the processor info and the activeTask may have info form another processor
        activeTask["processor"] = null; 
        task = utils.deepMerge(activeTask, task);
        hubAssertions(taskDiff, task);
      } else if (task.processor.command !== "start" && task.processor.command !== "init") {
        console.error("Should have activeTask if we have an instanceId", task);
        throw new Error("Should have activeTask if we have an instanceId");
      }
    }
    let requestId;
    if (req) {
      requestId = req.id;
    }
    task = await processorInHubOut_async(task, activeTask, requestId);
    // Update the processor information
    if (activeTask && Object.keys(activeTask).length !== 0) {
      activeTask.processors = task.processors;
      await setActiveTask_async(activeTask);
    }
    if (task.hub.command !== "partial") {
      task = checkLockConflict(task, activeTask);
      if (!task.hub.coprocessing) {
        task = checkAPIRate(task);
      }
      task = await processError_async(task, tasksStore_async);
    }
    if (task.hub.command === "update" || task.hub.command === "init") {
      // We may receive a diff where familyId is not sent but
      // we need familyId to set the outputStore_async
      task.familyId = task.familyId || activeTask.familyId;
      task = await processOutput_async(task, outputStore_async);
    }
    if (haveCoprocessor && !task.hub.coprocessing && !task.hub.coprocessingDone) {
      utils.logTask(task, "sending to coprocessor");
      // Send to first coprocessor
      // We will receive the task back from the coprocessor through websocket
      if (task.instanceId && task.hub.command !== "partial") {
        // To avoid updates being routed to coprocessor before init completes
        await taskLock(task.instanceId, "taskProcess");
      }
      await taskSync_async(task.instanceId, task);
      return null;
    }
  } catch (err) {
    if (err instanceof RequestError) {
      utils.logTask(task, "Error in /hub/api/task " + err.code + " " + err.message, err.origError);
    } else {
      utils.logTask(task, "Error in /hub/api/task " + err.message, task);
      throw err;
    }
  }
  return task;
}

export { taskProcess_async }