/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, activeTaskProcessorsStore_async, instancesStore_async, outputStore_async} from "./storage.mjs";
import startTask_async from "./startTask.mjs";

// Should probably split out errorTask_async
export async function errorTask_async(task) {
  // Should be an assertion
  if (!task.hub.commandArgs?.errorTask) {
    console.log("task", task);
    throw new Error("Called errorTask_async on a task that is not errored");
  }
  let nextTaskId = task.hub.commandArgs.errorTask;
  console.log("Task " + task.id + " error, next " + nextTaskId);
  await instancesStore_async.set(task.instanceId, task);
  if (nextTaskId) {
    const initTask = {
      id: nextTaskId,
      userId: task.userId,
      groupId: task?.groupId,
      familyId: task.familyId,
    }
    await startTask_async(initTask, false, task.hub["sourceProcessorId"], task.instanceId);
    // In theory the startTask_async will update activeTasksStore_async and that will send the task to the correct processor(s)
  }
}