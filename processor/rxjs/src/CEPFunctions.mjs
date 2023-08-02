/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";
import { commandUpdateSync_async } from "./commandUpdateSync.mjs";
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

  myCEPFunc: async function(functionName, wsSendTask, origTask, CEPtask, args) {
    const increment = args.increment;
    // No reason to ignore start
    if (CEPtask.processor.command === "start") {
      console.log("myCEPFunc doing nothing for start command")
      return;
    }
    /*
    if (CEPtask.output.CEPCount === 2) {
      console.log("myCEPFunc stopped with CEPCount " + CEPtask.output.CEPCount);
      return
    }
    */
    let syncTask = {}
    syncTask["output"] = {};
    syncTask.output["CEPCount"] = CEPtask.output.CEPCount ? CEPtask.output.CEPCount + increment : 1;
    console.log("CEPCount", CEPtask.output.CEPCount, increment);
    await commandUpdateSync_async(wsSendTask, CEPtask, syncTask);
    console.log("TaskConversation " + functionName + " called on " + CEPtask.id + " set by " + origTask.id);
    CEPtask.output.modifiedBy = origTask.id;
  },

};

export { CEPFunctions };
