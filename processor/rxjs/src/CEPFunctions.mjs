/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";
//import { commandUpdate_async } from "./commandUpdate.mjs";
import { utils } from "./utils.mjs";

const CEPFunctions = {

  register: function(functionName, func) {
    console.log("CEPFunctions register", functionName);
    if (typeof func === "function") {
      CEPFunctions[functionName] = func;
    }
  },

  get: function(funcName) {
    if (typeof CEPFunctions[funcName] === 'function') {
        return CEPFunctions[funcName];
    } else {
        throw new Error('Invalid function name ' + funcName);
    } 
  },


  // A demo of CEP where we are modifying the task "on the fly" during coprocessing
  // Because we are modifying the same task instance we do not use the commandUpdate_async
  // We cannot modify the task after coprocessing because those changes will not be dispatched
  CEPIncrement: async function(functionName, wsSendTask, CEPinstanceId, task, args) {
    const increment = args.increment;
    // We cannot send an update to a command tha has not already been stored as active
    // Otherwise the diff communication will fail.
    if (task.processor.command === "start" || task.processor.command === "init") {
      utils.logTask(task, "CEPIncrement doing nothing for start and init command")
      return;
    }
    if (task.processor.coprocessingDone) {
      utils.logTask(task, "CEPIncrement ignoring task after coprocessing");
      return
    }
    if (task.processor.commandArgs.sync) {
      utils.logTask(task, "CEPIncrement doing nothing for sync")
      return;
    }
    if (task.output.CEPCount > 100) {
      utils.logTask(task, "CEPIncrement stopped with CEPCount " + task.output.CEPCount);
      return
    }
    let syncDiff = {}
    syncDiff["output"] = {};
    syncDiff.output["CEPCount"] = task.output.CEPCount ? task.output.CEPCount + increment : increment;
    //syncDiff.output["CEPinitiatingProcessorId"] = task.processor.initiatingProcessorId;
    utils.logTask(task, "CEPCount", task.output.CEPCount, increment);
    //await commandUpdate_async(wsSendTask, task, syncDiff, true);
    utils.logTask(task, functionName + " called on " + task.id + " CEP created by " + CEPinstanceId);
    task.output["modifiedBy"] = CEPinstanceId;
    task.output["CEPCount"] = syncDiff.output["CEPCount"];
    return task;
  },

};

export { CEPFunctions };
