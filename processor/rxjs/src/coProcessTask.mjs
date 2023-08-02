/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";
import { utils } from "./utils.mjs";
import { CEPFunctions } from "./CEPFunctions.mjs";

export async function coProcessTask_async(wsSendTask, task, CEPFuncs) {
  let updatedTask = {};
  try {
    console.log("coProcessTask_async", task.id);
    if (taskFunctions.hasOwnProperty(`${task.type}_async`)) {
      updatedTask = await taskFunctions[`${task.type}_async`](task.type, wsSendTask, task, CEPFuncs);
    } else {
      updatedTask = task;
    }
    // Create the CEP during the start of the command
    if (task.processor["command"] === "start") {
      // How about overriding a match. createCEP needs more review/testing
      // Create two functions
      if (task.config?.ceps) {
        for (const key in task.config.ceps) {
          if (task.config.ceps.hasOwnProperty(key)) {
            const functionName = task.config.ceps[key].functionName;
            const args = task.config.ceps[key].args;
            utils.createCEP(CEPFuncs, task, key, CEPFunctions.get(functionName), functionName, args);
          }
        }
      }
      console.log("coProcessTask_async CEPFuncs", CEPFuncs);
    }
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
    // if running as a coprocessor then send the task back to the hub
    console.log("RxJS Task Processor unknown component " + task.type);
    if (task.processor.coProcessing && !task.processor.coProcessingDone) {
      console.log("coProcessTask_async wsSendTask", task.id);
      wsSendTask(task);
    }
    //console.log("taskFunctions", taskFunctions);
    updatedTask = task;
  } catch (error) {
    console.error(`Command ${updatedTask.command} failed to send ${error}`);
  }
  //wsSendTask(updatedTask);
  return updatedTask;
}