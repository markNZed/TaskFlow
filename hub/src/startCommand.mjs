/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { activeTasksStore_async, activeCoProcessors } from "./storage.mjs";
import syncTask_async from "./syncTask.mjs";
import RequestError from './routes/RequestError.mjs';
import startTask_async from "./startTask.mjs";

export async function startCommand_async(task, res) {
  const commandArgs = task.hub.commandArgs;
  const processorId = task.hub.sourceProcessorId;
  try {
    console.log(task.hub.requestId + " startCommand_async " + commandArgs.id + " from " + processorId);
    const initTask = {
      id: commandArgs.id,
      user: {id: task.user.id},
    };
    const prevInstanceId = commandArgs.prevInstanceId || task.instanceId;
    const coProcessorIds = Array.from(activeCoProcessors.keys());
    const haveCoProcessor = coProcessorIds.length > 0;
    // If we have one or more coprocessor 
    console.log("haveCoProcessor " + haveCoProcessor + " task.hub.coProcessing " + task.hub.coProcessing + " task.hub.coProcessingDone " + task.hub.coProcessingDone);
    if (haveCoProcessor) {
      // If this is not coming from a coprocessor
      if (task.hub.coProcessingDone) {
        activeTasksStore_async.set(task.instanceId, task);
        syncTask_async(task.instanceId, task);
      } else if (!task.hub.coProcessing) {
        startTask_async(initTask, true, processorId, prevInstanceId)
          .then(async (startTask) => {
            activeTasksStore_async.set(startTask.instanceId, startTask);
            return startTask;
          })
          .then(async (syncTask) => {
            syncTask_async(syncTask.instanceId, syncTask);
          })
      }
    } else {
      startTask_async(initTask, true, processorId, prevInstanceId)
        .then(async (syncTask) => {
          syncTask_async(syncTask.instanceId, syncTask);
          return syncTask;
        })
        .then(async (startTask) => {
          activeTasksStore_async.set(startTask.instanceId, startTask);
        })
    }
    // We can use this for the websocket so thre is no res provided in that case  
    if (res) {
      res.status(200).send("ok");
    }
  } catch (error) {
    const msg = `Error startCommand_async task ${task.id}: ${error.message}`;
    console.error(msg);
    if (res) {
      throw new RequestError(msg, 500, error);
    } else {
      throw new Error(msg);
    }
  }
  
}
