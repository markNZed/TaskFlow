/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async } from "./storage.mjs";
import { fetchTask_async } from "./fetchTask.mjs";
import { utils } from "./utils.mjs";

export async function syncTask_async(CEPtask, task) { 
  console.log("syncTask_async sync " + task.instanceId);
  task["command"] = "sync";
  task["instanceId"] = CEPtask.instanceId;
  // Copying before setting commandArgs avoids self reference
  task["commandArgs"] = {syncTask: JSON.parse(JSON.stringify(task))};
  delete task.commandArgs.syncTask.command;
  const lastTask = await activeTasksStore_async.get(task.instanceId);
  if (!lastTask) {
    throw new Error("No task found for " + task.instanceId);
  }
  const mergedTask = utils.deepMerge(lastTask, task);
  await activeTasksStore_async.set(task.instanceId, mergedTask)
  // We could send just the relevant fields of mergedTask?
  try {
    await fetchTask_async(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
