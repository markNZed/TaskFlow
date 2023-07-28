/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { activeTasksStore_async } from "./storage.mjs";
import syncTask_async from "./syncTask.mjs";

export async function startCommand_async(task) {
  try {
    console.log("startCommand_async", task.id);
    syncTask_async(task.instanceId, task)
      .then(async (syncTask) => activeTasksStore_async.set(syncTask.instanceId, syncTask))
  } catch (err) {
    console.log(`Error startCommand_async task`);
    throw new Error(`Error startCommand_async task ${task.id} ${err}`, 500, err);
  }
}

