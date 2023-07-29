/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { activeTasksStore_async, activeCoProcessors } from "./storage.mjs";
import syncTask_async from "./syncTask.mjs";

export async function errorCommand_async(task) {
  try {
    const processorId = task.hub["sourceProcessorId"];
    console.log(task.hub.requestId + " errorCommnad_async " + task.id + " from " + processorId);
    const coProcessorIds = Array.from(activeCoProcessors.keys());
    const haveCoProcessor = coProcessorIds.length > 0;
    if (haveCoProcessor) {
      if (task.hub.coProcessingDone) {
        syncTask_async(task.instanceId, task)
          .then(async () => activeTasksStore_async.set(task.instanceId, task))  
      } else {
        syncTask_async(task.instanceId, task);
      }
    } else {
      syncTask_async(task.instanceId, task)
        .then(async () => activeTasksStore_async.set(task.instanceId, task))  
    }
  } catch (error) {
    const msg = `Error errorCommand_async task ${task.id}: ${error.message}`;
    console.error(msg);
    if (res) {
      throw new RequestError(msg, 500, error);
    } else {
      throw new Error(msg);
    }
  }
}
