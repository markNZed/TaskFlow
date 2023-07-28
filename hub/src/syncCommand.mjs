/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import syncTask_async from "./syncTask.mjs";

export async function syncCommand_async(task) {
    try {
      const processorId = task.hub["sourceProcessorId"];
      if (task.instanceId === undefined) {
        throw new Error("Missing task.instanceId");
      }
      const activeTask = await activeTasksStore_async.get(task.instanceId)
      if (!activeTask) {
        throw new Error("No active task " + task.instanceId);
      }
      let commandArgs = JSON.parse(JSON.stringify(task.hub.commandArgs));
      let mergeTask = utils.deepMerge(activeTask, commandArgs.syncTask);
      mergeTask.hub = JSON.parse(JSON.stringify(task.hub));
      mergeTask.processor = JSON.parse(JSON.stringify(task.processor));
      console.log(mergeTask.meta.syncCount + " syncCommand_async " + mergeTask.id + " from " + processorId);
      mergeTask.meta = mergeTask.meta || {};
      if (task.hub.coProcessing) {
        mergeTask.hub["coProcessing"] = true;
      }
      console.log("Sync mergeTask " + mergeTask.id + " from " + processorId);
      const hash = utils.taskHash(mergeTask);
      mergeTask.meta.hash = hash;
      commandArgs.syncTask["meta"] = commandArgs.syncTask.meta || {};
      commandArgs.syncTask.meta["hash"] = hash;
      mergeTask.hub.commandArgs = commandArgs;
      //console.log("Sync mergeTask.hub.commandArgs", mergeTask.hub.commandArgs);
      // Don't await so the HTTP response may get back before the websocket update
      syncTask_async(mergeTask.instanceId, mergeTask)
        .then(async (syncTask) => {
          //console.log("syncCommand_async processors", syncTask.processors);
          activeTasksStore_async.set(syncTask.instanceId, syncTask);
        })
    } catch (error) {
      console.error(`Error sync task ${task.id}: ${error.message}`);
      throw new Error(`Error sync task ${task.id}: ${error.message}`, 500, error);
    }
  }
  
  