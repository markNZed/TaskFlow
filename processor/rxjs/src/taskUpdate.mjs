/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { CEPFunctions } from "./CEPFunctions.mjs";
import { utils } from "./utils.mjs";
import { coProcessor } from "./../config.mjs";

export async function taskUpdate_async(wsSendTask, task, CEPFuncs) {
  let updatedTask = {};
  try {
    console.log("taskUpdate_async", task.id);
    console.log("taskUpdate_async task.processor.coProcessing", task.processor.coProcessing, "task.processor.coProcessingDone", task.processor.coProcessingDone);
    if (taskFunctions.hasOwnProperty(`${task.type}_async`)) {
      updatedTask = await taskFunctions[`${task.type}_async`](task.type, wsSendTask, task, CEPFuncs);
    } else {
      console.log("RxJS Task Processor unknown component " + task.type);
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
      //console.log("taskUpdate_async CEPFuncs", CEPFuncs);
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
    console.log("taskUpdate_async null so task replaces updatedTask", updatedTask.id);
    // The updatedTask.processor will take effect in wsSendTask
    // We are not working at the Task scope here so OK to reuse this 
  }
  if (updatedTask.error) {
    console.error("Task error ", updatedTask.error)
  }
  try {
    if (coProcessor) {
      // Check for changes to the task
      const diff = utils.getObjectDifference(task, updatedTask);
      if (Object.keys(diff).length > 0) {
        console.log("DIFF task vs updatedTask", diff);
      }
      const hashTask = updatedTask.processor["hashTask"]
      const diffTask = utils.getObjectDifference(hashTask, updatedTask);
      delete diffTask.processor.hashTask; // Only used internally
      diffTask["instanceId"] = updatedTask.instanceId;
      diffTask["id"] = updatedTask.id;
      diffTask["processor"] = updatedTask.processor;
      console.log("taskUpdate_async wsSendTask", diffTask.id);
      wsSendTask(diffTask);
    } else {
      // This needs more testing
      // When not a coprocessor what do we want to do?
      // Which command sshould we support here?
      // This is similar to the old do_task
      if (updatedTask.command === "update") {
        // Should be moved to a central place e.g. fetchTask_async
        const activeTask = await activeTasksStore_async.get(task.instanceId);
        const hashTask = activeTask.processor["hashTask"]
        const updatedTask = utils.getObjectDifference(hashTask, updatedTask);
        updatedTask["instanceId"] = activeTask.instanceId;
        updatedTask["id"] = activeTask.id;
        updatedTask["processor"] = task.processor;
        try {
          await fetchTask_async(updatedTask);
        } catch (error) {
          console.error(`Command ${updatedTask.command} failed to fetch ${error}`);
        }
      } else {
        console.log("taskUpdate_async nothing to do");
      }
    }
  } catch (error) {
    console.log("taskUpdate_async updatedTask", updatedTask);
    console.error(`Command ${updatedTask.command} failed to send ${error}`);
  }
  //wsSendTask(updatedTask);
  return updatedTask;
}
