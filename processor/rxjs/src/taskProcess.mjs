/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";
import { CEPFunctions } from "./CEPFunctions.mjs";
import { utils } from "./utils.mjs";
import { processorId, coProcessor } from "../config.mjs";

export async function taskProcess_async(wsSendTask, task, CEPFuncs) {
  let updatedTask = null;
  try {
    console.log("taskProcess_async", task.id);
    console.log("taskProcess_async task.processor.coProcessing", task.processor.coProcessing);
    if (task.processor["command"] === "error") {
      console.log("RxJS Task Processor error so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (task.processor?.commandArgs?.sync) {
      console.log("RxJS Task Processor sync so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (taskFunctions.hasOwnProperty(`${task.type}_async`)) {
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
            utils.createCEP(CEPFuncs, CEPFunctions, task, key, task.config.ceps[key]);
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
    updatedTask.error = {message: e.message};
    updatedTask.command = "update";
    updatedTask.commandArgs = {lockBypass: true};
  }
  if (updatedTask?.error) {
    console.error("Task error: ", updatedTask.error)
  }
  try {
    if (coProcessor) {
      if (updatedTask === null) {
        updatedTask = task;
        console.log("taskProcess_async null so task replaces updatedTask", updatedTask.id);
        // The updatedTask.processor will take effect in wsSendTask
        // We are not working at the Task scope here so OK to reuse this 
      } else if (updatedTask.command) {
        // This processor wants to make a change
        // The original processor will no longer see the change as coming from it
        console.log("taskProcess_async initiatingProcessorId updated");
        updatedTask.processor["initiatingProcessorId"] = processorId;
      }
      if (!updatedTask.command) {
        // Because wsSendTask is expecting task.command
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
