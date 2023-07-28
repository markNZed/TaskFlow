/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, activeTaskProcessorsStore_async, instancesStore_async, outputStore_async} from "./storage.mjs";
import startTask_async from "./startTask.mjs";

export async function doneTask_async(task) {
  // Should be an assertion
  if (!task.hub.commandArgs?.done) {
    console.log("task", task);
    throw new Error("Called doneTask_async on a task that is not done");
  }
  let nextTaskId = task.hub.commandArgs?.nextTaskId;
  console.log("Task " + task.id + " done, next " + nextTaskId);
  await instancesStore_async.set(task.instanceId, task);
  // We should send a delete message to all the copies and also delete those (see Meteor protocol?)
  // !!!
  activeTasksStore_async.delete(task.instanceId);
  activeTaskProcessorsStore_async.delete(task.instanceId);
  if (nextTaskId) {
    const initTask = {
      id: nextTaskId,
      user: {id: task.user.id},
      groupId: task?.groupId,
      familyId: task.familyId,
    }
    let processorId = task.hub.initiatingProcessorId || task.hub.sourceProcessorId;
    task.processor = task.processors[processorId];
    await startTask_async(initTask, false, processorId, task.instanceId);
    // In theory the startTask_async will update activeTasksStore_async and that will send the task to the correct processor(s)
  }
}