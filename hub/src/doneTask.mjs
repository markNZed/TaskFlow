/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, instancesStore_async} from "./storage.mjs";
import newTask_async from "./newTask.mjs";

export async function doneTask_async(task) {
  if (task.state?.done) {
    let result;
    console.log("Task done through proxy " + task.id);
    task.state.done = false;
    instancesStore_async.set(task.instanceId, task);
    // We should send a delete message to all the copies and also delete those (see Meteor protocol)
    activeTasksStore_async.delete(task.instanceId);
    // Fetch from the Task Hub
    let newTask = await newTask_async(task.nextTask, task.userId, false, task.source, task.newSource, task.sessionId, task?.groupId, task.stackPtr, task.nextTask, task);
    // In theory the newTask_async will update activeTasksStore_async and that will send the task to the correct processor(s)
    return newTask;
  } else {
    throw new Error("Called doneTask_async on a task that is not done");
  }
}