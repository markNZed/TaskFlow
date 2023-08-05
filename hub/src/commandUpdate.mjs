/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { activeTasksStore_async, activeTaskProcessorsStore_async, instancesStore_async, activeCoProcessors } from "./storage.mjs";
import taskSync_async from "./taskSync.mjs";
import RequestError from './routes/RequestError.mjs';
import { commandStart_async } from "./commandStart.mjs";
import { haveCoProcessor } from "../config.mjs";
import { Mutex } from 'async-mutex';

const mutexes = new Map();

async function doneTask_async(task) {
  // Should be an assertion
  if (!task.hub.commandArgs?.done) {
    console.log("task", task);
    throw new Error("Called doneTask_async on a task that is not done");
  }
  let nextTaskId = task.hub.commandArgs?.nextTaskId;
  console.log("Task " + task.id + " done, next " + nextTaskId);
  await instancesStore_async.set(task.instanceId, task);
  // We should send a delete message to all the copies and also delete those (see Meteor protocol?)
  // !!!
  activeTasksStore_async.delete(task.instanceId);
  activeTaskProcessorsStore_async.delete(task.instanceId);
  if (nextTaskId) {
    const initTask = {
      id: nextTaskId,
      user: {id: task.user.id},
      groupId: task?.groupId,
      familyId: task.familyId,
    }
    let processorId = task.hub.initiatingProcessorId || task.hub.sourceProcessorId;
    task.processor = task.processors[processorId];
    task.hub.coProcessingDone = false;
    // Seems weird having this here. 
    if (haveCoProcessor) {
      //task.hub.coProcessing = false;
    }
    task.hub.commandArgs = {
      init: initTask,
      prevInstanceId: task.instanceId,
      authenticate: false, // Do we need this because request is not coming from internet but local processor, would be better to detect this in the authentication?
    }
    await commandStart_async(task);
    //await taskStart_async(initTask, false, processorId, task.instanceId);
    // In theory commandStart_async will update activeTasksStore_async and that will send the task to the correct processor(s)
  }
}

async function doUpdate(commandArgs, task, res) {
  if (commandArgs?.done) {
    console.log("Update task done " + task.id + " in state " + task.state?.current + " sync " + commandArgs.sync);
    await doneTask_async(task);
  } else {
    // The increment is being done in activeTasksStore_async.set to provide an atomic operation
    if (!task?.meta?.updateCount) {
      console.log("doUpdate task ", task);
    }
    task.meta.updateCount = task.meta.updateCount + 1;
    console.log("Update task " + task.id + " in state " + task.state?.current + " sync:" + commandArgs.sync + " instanceId:" + task.instanceId + " updateCount:" + task.meta.updateCount);
    // Don't await so the HTTP response may get back before the websocket update
    await taskSync_async(task.instanceId, task)
      .then(async () => {
        utils.hubActiveTasksStoreSet_async(activeTasksStore_async, task);
      });
    // We can use this for the websocket so thre is no res provided in that case  
    if (res) {
      res.status(200).send("ok");
    }
  }
}

export async function commandUpdate_async(task, res) {
  if (task.instanceId === undefined) {
    throw new Error("Missing task.instanceId");
  }
  // Get or create the mutex for this instanceId
  let mutex = mutexes.get(task.instanceId);
  if (!mutex) {
    mutex = new Mutex();
    mutexes.set(task.instanceId, mutex);
  }
  // Lock the mutex
  const release = await mutex.acquire();
  //console.log("commandUpdate_async lock", task.instanceId);
  try {
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
    task.meta.updateCount = activeTask.meta.updateCount;
    console.log(task.meta.broadcastCount + " commandUpdate_async " + task.id);
    if (haveCoProcessor) {
      if (task.hub.coProcessingDone) {
        await doUpdate(commandArgs, task, res);       
      } else {
        taskSync_async(task.instanceId, task);
      }
    } else {
      await doUpdate(commandArgs, task, res);       
    }
  } catch (error) {
    const msg = `Error commandUpdate_async task ${task.id}: ${error.message}`;
    console.error(msg);
    if (res) {
      throw new RequestError(msg, 500, error);
    } else {
      console.log("commandUpdate_async task", task);
      throw new Error(msg);
    }
  } finally {
    // Always release the lock
    //console.log("commandUpdate_async release", task.instanceId);
    release();
  }
}
