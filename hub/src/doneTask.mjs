/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { processors, tasktemplates } from "./configdata.mjs";
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
    let newTask = await newTask_async(task.nextTask, userId, false, task.source, task.newSource, task.sessionId, task?.groupId, task.stackPtr, task.nextTask, task);
    // What is the active tasktemplate?
    const tasktemplateName = newTask.stack[newTask.stackPtr - 1]
    //console.log("tasktemplateName", tasktemplateName);
    const tasktemplate = tasktemplates["root." + tasktemplateName]
    //console.log("tasktemplate", tasktemplate);
    const environments = tasktemplate.environments;
    // Need to deal with multiple environments.
    // If the task.source is not in the environments array then we need to send the task to the relevant processor.
    //console.log("environments", environments);
    //console.log("task.source", task.source);
    if (environments.indexOf(task.source) !== -1) {
      // The source is in the environments array so we can just return.
      console.log("Remember to deal with multiple environments")
      result = newTask
    } else if (environments.length === 1) {
      // The desired environment
      const environment = environments[0];
      // Assuming there is one processor for each environment
      const processor = processors["root." + environment];
      //console.log("processor", processor);
      // send the task to the correct processor
      if (environment === "nodejs") {
        newTask.destination = processor.url + "/api/task/update";
        //console.log("newTask", newTask)
        // This update activity basically creates the task on the processor
        newTask = await updateTask_async(newTask)
        result = newTask
      } else {
        throw new Error("Need to deal with other environments than nodejs " + environment);
      }
    } else {
        throw new Error("Need to deal with multiple environments")
    }
    return result;
  } else {
    throw new Error("Called doneTask_async on a task that is not done");
  }
}