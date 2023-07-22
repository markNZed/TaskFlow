/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { syncTask_async } from "../syncTask.mjs";

const TaskConversation_async = async function (taskName, wsSendTask, task, CEPFuncs) {
  const T = utils.createTaskValueGetter(task);

  // Monitor for root.conversation.chatgptzeroshot
  const match = "root.conversation.chatgptzeroshot.start";
  // Through the closure we can access task from myCEPFunc
  const myCEPFunc = (CEPtask) => {
    // No reason to ignore start
    if (CEPtask.processor.command === "start") {
      console.log("CEPFunc doing nothing for start command")
      return;
    }
    // We want to avoid a loop because we are requesting a sync
    if (CEPtask.command === "sync") {
      console.log("CEPFunc doing nothing for sync command")
      return;
    }
    /*
    if (CEPtask.output.CEPCountNew === 2) {
      console.log("Stopped with CEPCountNew " + CEPtask.output.CEPCountNew);
      return
    }
    */
    // From here can we modify the CEPtask
    // I guess yes
    // We don't need to return it because we can modify the reference
    // We need to be able to do a partial update
    //  New command sync
    const oldCEPtask = JSON.parse(JSON.stringify(CEPtask));
    let syncTask = {}
    syncTask["instanceId"] = oldCEPtask.instanceId;
    syncTask["output"] = {};
    syncTask.output["CEPCountNew"] = oldCEPtask.output.CEPCountNew ? oldCEPtask.output.CEPCountNew + 1 : 1;
    syncTask_async(syncTask);
    console.log("TaskConversation CEPFunc sync target " + CEPtask.id + " source " + task.id, CEPtask);
    return;
    //console.log("CEPtask:", CEPtask);
    // Delete all but keep the reference
    Object.keys(CEPtask).forEach((key) => {
      delete CEPtask[key];
    });
    CEPtask["id"] = oldCEPtask.id; // need this?
    CEPtask["instanceId"] = oldCEPtask.instanceId;
    CEPtask["type"] = oldCEPtask.type;
    CEPtask["processor"] = oldCEPtask.processor;
    CEPtask["output"] = {};
    CEPtask.output["CEPCount"] = oldCEPtask.output.CEPCount ? oldCEPtask.output.CEPCount + 1 : 1;
    // Could try to call update from here?
    CEPtask["command"] = "sync";
    CEPtask["commandArgs"] = {};
    console.log("TaskConversation CEPFunc target " + CEPtask.id + " source " + task.id + " sync");
  }
  utils.createCEP(CEPFuncs, task, match, myCEPFunc);

  console.log(`${taskName} in state ${task.state.current}`);

  return null;
};

export { TaskConversation_async };
