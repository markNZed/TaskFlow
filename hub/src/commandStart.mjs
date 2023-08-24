/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { activeTasksStore_async, instancesStore_async } from "./storage.mjs";
import taskSync_async from "./taskSync.mjs";
import RequestError from './routes/RequestError.mjs';
import taskStart_async from "./taskStart.mjs";
import { haveCoProcessor } from "../config.mjs";

export async function commandStart_async(task, res) {
  const commandArgs = task.hub.commandArgs;
  let processorId = task.hub.sourceProcessorId;
  try {
    utils.logTask(task, "commandStart_async from processorId:" + processorId);
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
    utils.logTask(task, "commandStart_async coProcessingDone:", task.hub.coProcessingDone, "initTask", initTask);
    const prevInstanceId = commandArgs.prevInstanceId || task.instanceId;
    if (haveCoProcessor) {
      if (task.hub.coProcessingDone) {
        taskStart_async(initTask, authenticate, processorId, prevInstanceId)
          .then(async (startTask) => {
            await instancesStore_async.set(startTask.instanceId, startTask);
            await taskSync_async(startTask.instanceId, startTask);
            //utils.logTask(task, "commandStart_async startTask.processors", startTask.processors);
            //utils.logTask(task, "commandStart_async startTask.processor", startTask.processor);
            //utils.logTask(task, "commandStart_async startTask.hub", startTask.hub);
            utils.hubActiveTasksStoreSet_async(activeTasksStore_async, startTask);
          })
      } else {
        await taskSync_async(task.instanceId, task);
        // Should not store this - are we storing on the Processors? 
        // Start should not function as an update. Could get out of sync when using task to start another task.
        //utils.hubActiveTasksStoreSet_async(activeTasksStore_async, task);
      }
    } else {
      taskStart_async(initTask, authenticate, processorId, prevInstanceId)
        .then(async (startTask) => {
          await instancesStore_async.set(startTask.instanceId, startTask);
          await taskSync_async(startTask.instanceId, startTask);
          utils.hubActiveTasksStoreSet_async(activeTasksStore_async, startTask);
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
