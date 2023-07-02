/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { fetchTask_async } from "./fetchTask.mjs";

export async function do_task_async(wsSendTask, task) {
    let updated_task = {};
    let idx = 0;
    if (task?.stackPtr) {
      idx = task.stackPtr - 1;
      console.log("Component ", task.stack, " idx ", idx);
    }
    if (taskFunctions.hasOwnProperty(`${task.stack[idx]}_async`)) {
      try {
        updated_task = await taskFunctions[`${task.stack[idx]}_async`](task.stack[idx], wsSendTask, task);
      } catch (e) {
        console.log("do_task_async error", e, task);
      }
      // Returning null is  away of doing nothing
      if (updated_task !== null) {
        await activeTasksStore_async.set(task.instanceId, updated_task)
        if (updated_task?.command === "start") {
          // This is not working/used yet
          throw new Error("start not implemented yet");
          const task = {
            userId: updated_task.userId,
            startId: updated_task.commandArgs.id,
            hub: {},
            command: "start",
          }
          await fetchTask_async(task);
        } else {
          if (!updated_task?.command) {
            throw new Error("Missing command in updated_task");
          }
          await fetchTask_async(updated_task);
        }
      } else {
        console.log("do_task_async null " + task.id);
      }
    } else {
      console.log("NodeJS Task Processor unknown component at idx " + idx + " : " + task.stack);
      //console.log("taskFunctions", taskFunctions);
      updated_task = task;
    }

}