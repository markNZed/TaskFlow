/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async } from "./storage.mjs";
import { processorId } from "../config.mjs";
import { utils } from "./utils.mjs";

export async function commandUpdateSync_async(wsSendTask, task, diff) { 
  console.log("commandUpdateSync_async sync");
  const lastTask = await activeTasksStore_async.get(task.instanceId);
  lastTask.processor["hashTask"] = JSON.parse(JSON.stringify(lastTask)); // deep copy to avoid self-reference
  if (!lastTask) {
    throw new Error("No diff found for " + diff.instanceId);
  }
  //console.log("commandUpdateSync_async sync processor", lastTask.processor);
  const mergedTask = utils.deepMerge(lastTask, diff);
  // Deep copy task.processor to avoif changes to task that was passed in
  mergedTask.processor = JSON.parse(JSON.stringify(task.processor)); 
  mergedTask["command"] = "update";
  mergedTask["commandArgs"] = {
    syncTask: JSON.parse(JSON.stringify(diff)),
    sync: true,
    lockBypass: true,
  };
  delete mergedTask.commandArgs.syncTask.command;
  delete mergedTask.commandArgs.syncTask.commandArgs;
  // Because this is a fresh command sent from the coProcessor not part of the coProcessing pipeline
  mergedTask.processor["coProcessing"] = false;
  mergedTask.processor["coProcessingDone"] = true; // So it is not coprocessed again
  // Because it is this processor that is the initiator of the sync
  mergedTask.processor["initiatingProcessorId"] = null;
  try {
    wsSendTask(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
