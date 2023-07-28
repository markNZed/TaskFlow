/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { activeTasksStore_async } from "./storage.mjs";
import syncTask_async from "./syncTask.mjs";

export async function errorCommand_async(task) {
  try {
    let processorId;
    console.log(task.hub.requestId + " errorCommnad_async " + task.id + " from " + processorId);
    syncTask_async(task.instanceId, task)
      .then(async (syncTask) => activeTasksStore_async.set(syncTask.instanceId, syncTask))
  } catch (error) {
    console.error(`Error in errorCommnad_async task ${task.id}: ${error.message}`);
    throw new Error(`Error in errorCommnad_async task ${task.id}: ${error.message}`, 500, error);
  }
}
