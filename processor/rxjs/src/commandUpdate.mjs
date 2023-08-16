/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async } from "./storage.mjs";
import { utils } from "./utils.mjs";

export async function commandUpdate_async(wsSendTask, task, diff, sync = false) { 
  console.log("commandUpdate_async sync");
  const lastTask = await activeTasksStore_async.get(task.instanceId);
  if (!lastTask) {
    throw new Error("No lastTask found for " + task.instanceId);
  }
  if (!diff || Object.keys(diff).length === 0) {
    console.log("No diff so update cancelled.", diff);
    return;
  }
  //console.log("commandUpdate_async sync processor", lastTask.processor);
  const mergedTask = utils.deepMerge(lastTask, diff);
  // Deep copy task.processor to avoif changes to task that was passed in
  mergedTask.processor = JSON.parse(JSON.stringify(task.processor)); 
  mergedTask["command"] = "update";
  if (sync) {
    mergedTask["commandArgs"] = {
      syncTask: JSON.parse(JSON.stringify(diff)),
      sync: true,
      lockBypass: true,
    };
    delete mergedTask.commandArgs.syncTask.command;
    delete mergedTask.commandArgs.syncTask.commandArgs;
  }
  // Because this is a fresh command sent from the coprocessor not part of the coprocessing pipeline
  mergedTask.processor["coProcessing"] = false;
  mergedTask.processor["coProcessingDone"] = true; // So it is not coprocessed again
  // Because it is this processor that is the initiator of the sync
  mergedTask.processor["initiatingProcessorId"] = null;
  try {
    //console.log("commandUpdate_async mergedTask.state", mergedTask.state);
    wsSendTask(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
