/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";

export async function taskProcess_async(wsSendTask, task) {
    let updatedTask = {};
    let idx = 0;
    if (taskFunctions.hasOwnProperty(`${task.type}_async`)) {
      try {
        updatedTask = await taskFunctions[`${task.type}_async`](task.type, wsSendTask, task);
      } catch (e) {
        console.error(e);
        updatedTask = task;
        // Strictly we should not be updating the task object in the processor
        // Could set updatedTask.processor.command = "error" ?
        updatedTask.error = e.message;
        updatedTask.command = "update";
      }
      // Returning null is  away of doing nothing
      if (updatedTask !== null) {
        if (updatedTask.error) {
          console.error("Task error ", updatedTask.error)
        }
        if (updatedTask?.command === "start") {
          // This is not working/used yet
          throw new Error("start not implemented yet");
          const task = {
            user: {id: updatedtask.user.id},
            startId: updatedTask.commandArgs.id,
            hub: {},
            command: "start",
          }
          wsSendTask(task);
        } else if (updatedTask?.command === "update") {
          console.log("taskProcess_async sending");
          try {
            wsSendTask(updatedTask);
          } catch (error) {
            console.error(`Command ${updatedTask.command} failed to fetch ${error}`);
          }
        } else {
          console.log("taskProcess_async nothing to do");
        }
      } else {
        console.log("taskProcess_async null " + task.id);
      }
    } else {
      console.log("NodeJS Task Processor unknown component " + task.type);
      //console.log("taskFunctions", taskFunctions);
      updatedTask = task;
    }

}