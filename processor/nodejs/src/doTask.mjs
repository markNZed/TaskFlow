/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { processorId } from "../config.mjs";
import { taskFunctions } from "../Task/taskFunctions.mjs";
import { instancesStore_async, activeTasksStore_async } from "./storage.mjs";

export async function do_task_async(wsSendTask, task) {
    let updated_task = {};
    let idx = 0;
    if (task?.stackPtr) {
      idx = task.stackPtr - 1;
      console.log("Component ", task.stack, " idx ", idx);
    }
    if (taskFunctions.hasOwnProperty(`${task.stack[idx]}_async`)) {
      updated_task = await taskFunctions[`${task.stack[idx]}_async`](wsSendTask, task);
      updated_task.newSource = processorId;
      // This will then trigger the syncTasks_async
      // Not sure we need to await on this
      await activeTasksStore_async.set(wsSendTask, task.instanceId, task)
    } else {
      console.log("NodeJS Task Processor unknown component at idx " + idx + " : " + task.stack);
      updated_task = task;
    }
    await instancesStore_async.set(task.instanceId, updated_task);
    //console.log("instancesStore_async set " + task.instanceId);
    //console.log(updated_task)

    // When next task is running on the same environment. Should still let this go to Hub and come back.
    // The Hub is using task.destination
    let i = 0;
    while ((updated_task.environments.length === 1 && updated_task.environments[0] === "nodejs")) {
        // A sanity check to avoid erroneuos infinite loops
        i = i + 1;
        if (i > 10) {
          console.log("Unexpected looping on server_only ", updated_task);
          exit;
        }
        if (updated_task.state.done) {
          // Send to Hub and fetch next task
          // Set the destination to NodeJS and it would process also
          // The destination does not matter as it intercepts done.
          updated_task.destination = "NodeJS";
          console.log("NodeJS task done " + updated_task.id);
          //updated_task.state.done = false;
          await instancesStore_async.set(updated_task.instanceId, updated_task);
          // Fetch from the Task Hub
          updated_task = await updateTask_async(updated_task)
          //updated_task = await startTask_async(userId, updated_task.nextTask, updated_task);
        }
        if (updated_task.environments.length === 1 && updated_task.environments[0] === "nodejs") {
          updated_task = await do_task_async(wsSendTask, updated_task);
        } else {
          break;
        }
      }
    return updated_task;
}