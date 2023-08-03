/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import taskSync_async from "./taskSync.mjs";
import RequestError from './routes/RequestError.mjs';
import taskStart_async from "./taskStart.mjs";
import { haveCoProcessor } from "../config.mjs";

export async function commandStart_async(task, res) {
  const commandArgs = task.hub.commandArgs;
  let processorId = task.hub.sourceProcessorId;
  try {
    console.log(task.hub.requestId + " commandStart_async " + commandArgs.id + " from " + processorId);
    let initTask;
    let authenticate = true;
    if (commandArgs.init) {
      initTask = commandArgs.init;
      processorId = task.processor.id;
      if (commandArgs.authenticate !== undefined) {
        authenticate = commandArgs.authenticate;
      }
    } else {
      initTask = {
        id: commandArgs.id,
        user: {id: task.user.id},
      };
    }
    const prevInstanceId = commandArgs.prevInstanceId || task.instanceId;
    // If we have one or more coprocessor 
    console.log("haveCoProcessor " + haveCoProcessor + " task.hub.coProcessing " + task.hub.coProcessing + " task.hub.coProcessingDone " + task.hub.coProcessingDone);
    if (haveCoProcessor) {
      // If this is not coming from a coprocessor
      if (task.hub.coProcessingDone) {
        task.meta.hash = utils.taskHash(task);
        delete task.hub.hashTask;
        activeTasksStore_async.set(task.instanceId, task);
        taskSync_async(task.instanceId, task);
      } else if (!task.hub.coProcessing) {
        taskStart_async(initTask, authenticate, processorId, prevInstanceId)
          .then(async (startTask) => {
            startTask.meta.hash = utils.taskHash(startTask);
            delete startTask.hub.hashTask;
            activeTasksStore_async.set(startTask.instanceId, startTask);
            return startTask;
          })
          .then(async (syncTask) => {
            taskSync_async(syncTask.instanceId, syncTask);
          })
      }
    } else {
      taskStart_async(initTask, authenticate, processorId, prevInstanceId)
        .then(async (syncTask) => {
          taskSync_async(syncTask.instanceId, syncTask);
          return syncTask;
        })
        .then(async (startTask) => {
          startTask.meta.hash = utils.taskHash(startTask);
          delete startTask.hub.hashTask;
          activeTasksStore_async.set(startTask.instanceId, startTask);
        })
    }
    // We can use this for the websocket so thre is no res provided in that case  
    if (res) {
      res.status(200).send("ok");
    }
  } catch (error) {
    const msg = `Error commandStart_async task ${task.id}: ${error.message}`;
    console.error(msg);
    if (res) {
      throw new RequestError(msg, 500, error);
    } else {
      throw new Error(msg);
    }
  }
  
}
