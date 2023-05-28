/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { processorId } from "../config.mjs";
import { taskFunctions } from "./Task/taskFunctions.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { updateTask_async } from "./updateTask.mjs";

export async function do_task_async(wsSendTask, task) {
    let updated_task = {};
    let idx = 0;
    if (task?.stackPtr) {
      idx = task.stackPtr - 1;
      console.log("Component ", task.stack, " idx ", idx);
    }
    if (taskFunctions.hasOwnProperty(`${task.stack[idx]}_async`)) {
      task.source = processorId;
      updated_task = await taskFunctions[`${task.stack[idx]}_async`](wsSendTask, task);
      // Returning null is  away of doing nothing
      if (updated_task !== null) {
        // This will then trigger the syncTasks_async
        // Not sure we need to await on this
        // This will also trigger the ws to send the update I guess
        // We do not want this because we use the updateTask_async HTTP request
        //console.log("do_task_async setting activeTasksStore_async");
        // Pass null instead of wsSendTask to avoid sending update
        await activeTasksStore_async.set(null, task.instanceId, updated_task)
        // Send the update request
        // We may not want to do this for all tasks ? 
        // If the task is done then Hub will intercept this
        //console.log("do_task_async final task", updated_task)
        await updateTask_async(updated_task)
      } else {
        console.log("do_task_async null task " + task.id);
      }
    } else {
      console.log("NodeJS Task Processor unknown component at idx " + idx + " : " + task.stack);
      updated_task = task;
    }

}