/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { fetchTask_async } from "./fetchTask.mjs";
import { utils } from "./utils.mjs";

export async function do_task_async(wsSendTask, task, CEPFuncs) {
    let updatedTask = {};
    let idx = 0;
    if (taskFunctions.hasOwnProperty(`${task.type}_async`)) {
      try {
        updatedTask = await taskFunctions[`${task.type}_async`](task.type, wsSendTask, task, CEPFuncs);
      } catch (e) {
        console.error(e);
        updatedTask = task;
        // Strictly we should not be updating the task object in the processor
        // Could set updatedTask.processor.command = "error" ?
        updatedTask.error = e.message;
        updatedTask.command = "update";
      }
      // Returning null is a way of doing nothing
      if (updatedTask !== null && updatedTask.command) {
        if (updatedTask.error) {
          console.error("Task error ", updatedTask.error)
        }
        if (updatedTask.command === "start") {
          // This is not working/used yet
          throw new Error("start not implemented yet");
          const task = {
            user: {id: updatedtask.user.id},
            startId: updatedTask.commandArgs.id,
            hub: {},
            command: "start",
          }
          await fetchTask_async(task);
        } else if (updatedTask.command === "nop") {
          console.log("do_task_async nop " + task.id);
        } else {
          if (updatedTask.command === "update") {
            const activeTask = await activeTasksStore_async.get(task.instanceId);
            const updatedTask = utils.getObjectDifference(activeTask, task);
            updatedTask["instanceId"] = activeTask.instanceId;
          }
          try {
            await fetchTask_async(updatedTask);
          } catch (error) {
            console.error(`Command ${updatedTask.command} failed to fetch ${error}`);
          }
        } 
        return updatedTask;
      } else {
        console.log("do_task_async null " + task.id);
        return null;
      }
    } else {
      console.log("RxJS Task Processor unknown component " + task.type);
      //console.log("taskFunctions", taskFunctions);
      updatedTask = task;
    }

}