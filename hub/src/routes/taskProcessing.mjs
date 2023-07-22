/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import RequestError from './RequestError.mjs';

function transferCommand(task, activeTask, requestId) {
  const { command, id } = task.processor;
  let commandArgs = {};
  if (task.processor.commandArgs) {
    commandArgs = JSON.parse(JSON.stringify(task.processor.commandArgs))
  }
  task.processor.command = null;
  task.processor.commandArgs = null;
  const activeTaskProcessors = activeTask?.processors || {};
  activeTaskProcessors[id] = JSON.parse(JSON.stringify(task.processor));
  task.processors = activeTaskProcessors;
  task.hub = {
    command,
    commandArgs: commandArgs,
    sourceProcessorId: id,
    requestId: requestId,
  };
  return task;
}

function checkLockConflict(task, activeTask) {
  if (task.meta && task.hub.command !== "sync") {
    const lock = task.hub.commandArgs.lock || false;
    const unlock = task.hub.commandArgs.unlock || false;
    const lockBypass = task.hub.commandArgs.lockBypass || false;
    const processorId = task.hub.sourceProcessorId;
    
    if (unlock) {
      task.meta.locked = null;
    }
    
    if (lock && activeTask && !activeTask.meta?.locked) {
      task.meta.locked = processorId;
      //console.log("LOCKED ",task.id, processorId);
    } else if (activeTask && activeTask.meta?.locked && activeTask.meta.locked === processorId) {
      task.meta.locked = null;
    }
    
    if (activeTask && activeTask.meta?.locked && activeTask.meta.locked !== processorId && !lockBypass && !unlock) {
      const now = new Date();
      let updatedAt;
      if (task.meta.updatedAt) {
        updatedAt = new Date(task.meta.updatedAt.date);
      }
      
      const differenceInMinutes = (now - updatedAt) / 1000 / 60;
      
      if (differenceInMinutes > 5 || updatedAt === undefined) {
        console.log(`Task lock expired for ${processorId} locked by ${activeTask.meta.locked}`);
      } else {
        console.log(`Task lock conflict with ${processorId} command ${task.hub.command} locked by ${activeTask.meta.locked} ${differenceInMinutes} minutes ago.`);
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
    if (maxRequestCount) {
      //console.log(`Task request count: ${task.meta.requestCount} of ${maxRequestCount}`);
      task.meta.requestCount++;
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

export { transferCommand, checkLockConflict, checkAPIRate, processError, processOutput_async }