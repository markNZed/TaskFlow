/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";
import { commandUpdate_async } from "./commandUpdate.mjs";
import { utils } from "./utils.mjs";

const CEPFunctions = {

  register: function(functionName, func) {
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


  CEPIncrement: async function(functionName, wsSendTask, CEPinstanceId, task, args) {
    const increment = args.increment;
    // No reason to ignore start
    if (task.processor.command === "start") {
      console.log("CEPIncrement doing nothing for start command")
      return;
    }
    if (task.output.CEPCount > 100) {
      console.log("CEPIncrement stopped with CEPCount " + task.output.CEPCount);
      return
    }
    let syncDiff = {}
    syncDiff["output"] = {};
    syncDiff.output["CEPCount"] = task.output.CEPCount ? task.output.CEPCount + increment : 1;
    console.log("CEPCount", task.output.CEPCount, increment);
    await commandUpdate_async(wsSendTask, task, syncDiff, true);
    console.log("TaskConversation " + functionName + " called on " + task.id + " CEP created by " + CEPinstanceId);
    task.output.modifiedBy = CEPinstanceId;
  },

};

export { CEPFunctions };
