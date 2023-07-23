/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { syncTask_async } from "../syncTask.mjs";

const TaskConversation_async = async function (taskName, wsSendTask, task, CEPFuncs) {
  const T = utils.createTaskValueGetter(task);

  // Can we dynamically load CEPFuncs like we do Task Functions ?
  // Export CEPFuncs

  // Through the closure we can access task from myCEPFunc
  const myCEPFunc = (CEPtask, args) => {
    const increment = args.increment;
    // No reason to ignore start
    if (CEPtask.processor.command === "start") {
      console.log("myCEPFunc doing nothing for start command")
      return;
    }
    // We want to avoid a loop because we are using syncTask_async
    if (CEPtask.command === "sync") {
      console.log("myCEPFunc doing nothing for sync command")
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
    syncTask_async(CEPtask, syncTask);
    console.log("TaskConversation myCEPFunc called on " + CEPtask.id + " set by " + task.id);
    return;
  }

  const taskCEPfuncs = {
    "myCEPFunc": myCEPFunc,
  }

  // match could be a regex ?
  // CEP is either a function or DSL ?

  function getFunctionByName(taskCEPfuncs, funcName) {
    if (typeof taskCEPfuncs[funcName] === 'function') {
        return taskCEPfuncs[funcName];
    } else {
        throw new Error('Invalid function name ' + funcName);
    }
  }

  // How about overriding a match. createCEP needs more review/testing
  // Create two functions
  // Modify the argument to one of the functions on some condition
  if (task.config?.ceps) {
    for (const key in task.config.ceps) {
      if (task.config.ceps.hasOwnProperty(key)) {
        const funcionName = task.config.ceps[key].funcionName;
        const args = task.config.ceps[key].args;
        utils.createCEP(CEPFuncs, task, key, getFunctionByName(taskCEPfuncs, funcionName), args);
      }
    }
  }

  console.log(`${taskName} in state ${task.state.current}`);

  return null;
};

export { TaskConversation_async };
