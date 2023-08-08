/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { CEPFunctions } from "./CEPFunctions.mjs";
import { utils } from "./utils.mjs";
import { coProcessor } from "../config.mjs";

export async function taskProcess_async(wsSendTask, task, CEPFuncs) {
  let updatedTask = null;
  try {
    console.log("taskProcess_async", task.id);
    console.log("taskProcess_async task.processor.coProcessing", task.processor.coProcessing, "task.processor.coProcessingDone", task.processor.coProcessingDone);
    if (taskFunctions.hasOwnProperty(`${task.type}_async`)) {
      updatedTask = await taskFunctions[`${task.type}_async`](task.type, wsSendTask, task, CEPFuncs);
    } else {
      console.log("RxJS Task Processor unknown component " + task.type);
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
      //console.log("taskProcess_async CEPFuncs", CEPFuncs);
    }
  } catch (e) {
    console.error(e);
    updatedTask = task;
    // Strictly we should not be updating the task object in the processor
    // Could set updatedTask.processor.command = "error" ?
    updatedTask.error = e.message;
    updatedTask.command = "update";
  }
  if (updatedTask?.error) {
    console.error("Task error ", updatedTask.error)
  }
  try {
    if (coProcessor) {
      if (updatedTask === null) {
        updatedTask = task;
        console.log("taskProcess_async null so task replaces updatedTask", updatedTask.id);
        // The updatedTask.processor will take effect in wsSendTask
        // We are not working at the Task scope here so OK to reuse this 
      }
      console.log("taskProcess_async wsSendTask", updatedTask.id);
      // Becaus wsSendTask is expecting a task
      if (!updatedTask.command) {
        updatedTask.command = task.processor.command;
        updatedTask.commandArgs = task.processor.commandArgs;
      }
      wsSendTask(updatedTask);
    } else {
      // This needs more testing
      // When not a coprocessor what do we want to do?
      // Which command should we support here?
      // This is similar to the old do_task
      if (updatedTask?.command === "update") {
        console.log("taskProcess_async sending");
        wsSendTask(updatedTask);
      } else {
        console.log("taskProcess_async nothing to do");
      }
    }
  } catch (error) {
    console.log("taskProcess_async updatedTask", updatedTask);
    console.error(`Command ${updatedTask.command} failed to send ${error}`);
  }
  //wsSendTask(updatedTask);
  return updatedTask;
}
