/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { fetchTask_async } from "./fetchTask.mjs";
import { utils } from "./utils.mjs";

export async function coProcessTask_async(wsSendTask, task, CEPFuncs) {
    let updatedTask = {};
    let idx = 0;
    if (taskFunctions.hasOwnProperty(`${task.type}_async`)) {
      try {
        console.log("coProcessTask_async", task.id);
        updatedTask = await taskFunctions[`${task.type}_async`](task.type, wsSendTask, task, CEPFuncs);
      } catch (e) {
        console.error(e);
        updatedTask = task;
        // Strictly we should not be updating the task object in the processor
        // Could set updatedTask.processor.command = "error" ?
        updatedTask.error = e.message;
        updatedTask.command = "update";
      }
      if (updatedTask === null) {
        updatedTask = task;
        console.log("coProcessTask_async null so task replaces updatedTask", updatedTask.id);
        // The updatedTask.processor will take effect in wsSendTask
        // We are not working at the Task scope here so OK to reuse this 
      }
      try {
        //await fetchTask_async(updatedTask);
        console.log("coProcessTask_async wsSendTask", updatedTask.id);
        wsSendTask(updatedTask);
      } catch (error) {
        console.error(`Command ${updatedTask.command} failed to fetch ${error}`);
      }
      //wsSendTask(updatedTask);
    } else {
      console.log("RxJS Task Processor unknown component " + task.type);
      //console.log("taskFunctions", taskFunctions);
      updatedTask = task;
    }
    return updatedTask;
}