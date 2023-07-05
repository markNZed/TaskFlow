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
    if (taskFunctions.hasOwnProperty(`${task.type}_async`)) {
      try {
        updated_task = await taskFunctions[`${task.type}_async`](task.type, wsSendTask, task);
      } catch (e) {
        console.error(e);
        updated_task = task;
        // Strictly we should not be updating the task object in the processor
        // Could set updated_task.processor.command = "error" ?
        updated_task.error = e.message;
        updated_task.command = "update";
      }
      // Returning null is  away of doing nothing
      if (updated_task !== null) {
        if (updated_task.error) {
          console.error("Task error ", updated_task.error)
        }
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
      console.log("NodeJS Task Processor unknown component " + task.type);
      //console.log("taskFunctions", taskFunctions);
      updated_task = task;
    }

}