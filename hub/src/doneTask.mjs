/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, activeProcessorsStore_async, instancesStore_async, outputStore_async} from "./storage.mjs";
import newTask_async from "./newTask.mjs";

export async function doneTask_async(task) {
  if (task.state?.done) {
    console.log("Task done " + task.id);
    task.state.done = false;
    instancesStore_async.set(task.instanceId, task);
    let outputs = await outputStore_async.get(task.threadId) || {};
    outputs[task.id] = task.output;
    await outputStore_async.set(task.threadId, outputs); // Wait so available in newTask_async
    // We should send a delete message to all the copies and also delete those (see Meteor protocol)
    // !!!
    activeTasksStore_async.delete(task.instanceId);
    activeProcessorsStore_async.delete(task.instanceId);
    // Fetch from the Task Hub
    let newTask = await newTask_async(task.nextTask, task.userId, false, task.source, task.sessionId, task?.groupId, task.stackPtr, task.nextTask, task);
    // In theory the newTask_async will update activeTasksStore_async and that will send the task to the correct processor(s)
    return newTask;
  } else {
    throw new Error("Called doneTask_async on a task that is not done");
  }
}