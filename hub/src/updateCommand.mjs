/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import syncTask_async from "./syncTask.mjs";

export async function updateCommand_async(task) {
  try {
    const processorId = task.hub["sourceProcessorId"];
    if (task.instanceId === undefined) {
      throw new Error("Missing task.instanceId");
    }
    const activeTask = await activeTasksStore_async.get(task.instanceId)
    if (!activeTask) {
      throw new Error("No active task " + task.instanceId);
    }
    task = utils.deepMerge(activeTask, task);
    console.log(task.meta.syncCount + " updateCommand_async " + task.id + " from " + processorId);
    const commandArgs = task.hub["commandArgs"];
    // We intercept tasks that are done.
    if (commandArgs?.done) {
      console.log("Update task done " + task.id + " in state " + task.state?.current + " from " + processorId);
      await doneTask_async(task);
    } else {
      task.meta.updateCount = task.meta.updateCount + 1;
      task.meta.sourceProcessorId = processorId;
      console.log("Update task " + task.id + " in state " + task.state?.current + " from " + processorId);
      task.meta.hash = utils.taskHash(task);
      // Don't await so the HTTP response may get back before the websocket update
      syncTask_async(task.instanceId, task)
        .then(async () => activeTasksStore_async.set(task.instanceId, task)) 
    }
  } catch (error) {
    console.error(`Error updating task ${task.id}: ${error.message}`);
    throw new Error(`Error updating task ${task.id}: ${error.message}`, 500, error);
  }
}

  