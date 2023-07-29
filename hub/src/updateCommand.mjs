/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { activeTasksStore_async, activeCoProcessors } from "./storage.mjs";
import syncTask_async from "./syncTask.mjs";
import { doneTask_async } from "./doneTask.mjs";
import RequestError from './routes/RequestError.mjs';

async function doUpdate(commandArgs, task, res) {
  if (commandArgs?.done) {
    console.log("Update task done " + task.id + " in state " + task.state?.current);
    await doneTask_async(task);
  } else {
    task.meta.updateCount = task.meta.updateCount + 1;
    console.log("Update task " + task.id + " in state " + task.state?.current);
    task.meta.hash = utils.taskHash(task);
    // Don't await so the HTTP response may get back before the websocket update
    syncTask_async(task.instanceId, task)
      .then(async () => {
        activeTasksStore_async.set(task.instanceId, task);
      });
    // We can use this for the websocket so thre is no res provided in that case  
    if (res) {
      res.status(200).send("ok");
    }
  }
}

export async function updateCommand_async(task, res) {
  try {
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
    console.log(task.meta.broadcastCount + " updateCommand_async " + task.id);
    const prevInstanceId = commandArgs.prevInstanceId || task.instanceId;
    const coProcessorIds = Array.from(activeCoProcessors.keys());
    const haveCoProcessor = coProcessorIds.length > 0;
    if (haveCoProcessor) {
      if (task.hub.coProcessingDone) {
        await doUpdate(commandArgs, task, res);       
      } else {
        syncTask_async(task.instanceId, task);
      }
    } else {
      await doUpdate(commandArgs, task, res);       
    }
  } catch (error) {
    const msg = `Error updateCommand_async task ${task.id}: ${error.message}`;
    console.error(msg);
    if (res) {
      throw new RequestError(msg, 500, error);
    } else {
      throw new Error(msg);
    }
  }
}
