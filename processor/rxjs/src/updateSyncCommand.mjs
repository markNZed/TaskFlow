/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async } from "./storage.mjs";
import { processorId } from "../config.mjs";
import { utils } from "./utils.mjs";

export async function updateSyncCommand_async(wsSendTask, task, diff) { 
  console.log("updateSyncCommand_async sync");
  const lastTask = await activeTasksStore_async.get(task.instanceId);
  if (!lastTask) {
    throw new Error("No diff found for " + diff.instanceId);
  }
  //console.log("updateSyncCommand_async sync processor", lastTask.processor);
  const mergedTask = utils.deepMerge(lastTask, diff);
  mergedTask.processor = task.processor;
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
  mergedTask.meta["initiatingProcessorId"] = null;
  try {
    wsSendTask(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
