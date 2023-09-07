/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { processorId } from "../config.mjs";
import { taskLock } from './taskLock.mjs';

export async function commandUpdate_async(wsSendTask, task, diff, sync = false) { 
  utils.logTask(task, "commandUpdate_async");
  if (!diff || Object.keys(diff).length === 0) {
    utils.logTask(task, "No diff so update cancelled.", diff);
    return;
  }
  //utils.logTask(task, "commandUpdate_async sync processor", lastTask.processor);
  let mergedTask;
  // Deep copy task.processor to avoif changes to task that was passed in
  if (sync) {
    if (!diff.instanceId) {
      // Perhaps we should not support this and the CEP should modify the task in coprocessing to cover this case
      console.log("commandUpdate_async assuming that we are syncing self")
      diff["instanceId"] = task.instanceId
    }
    //utils.logTask(task, "commandUpdate_async requesting lock for sync", diff.instanceId);
    await taskLock(diff.instanceId);
    const lastTask = await activeTasksStore_async.get(diff.instanceId);
    if (!lastTask) {
      throw new Error("No lastTask found for " + diff.instanceId);
    }
    mergedTask = utils.deepMerge(lastTask, diff);
    mergedTask["commandArgs"] = {
      syncTask: JSON.parse(JSON.stringify(diff)),
      sync: true,
      lockBypass: true, // Could enforce this on the hub when sync is true
    };
    delete mergedTask.commandArgs.syncTask.command;
    delete mergedTask.commandArgs.syncTask.commandArgs;
    mergedTask.processor["coprocessingDone"] = true; // So sync is not coprocessed again, it can still be logged
  } else {
    //utils.logTask(task, "commandUpdate_async requesting lock for update", task.instanceId);
    await taskLock(task.instanceId);
    const lastTask = await activeTasksStore_async.get(task.instanceId);
    if (!lastTask) {
      throw new Error("No lastTask found for " + task.instanceId);
    }
    mergedTask = utils.deepMerge(lastTask, diff);
    mergedTask.processor["coprocessingDone"] = false;
  }
  mergedTask.processor = JSON.parse(JSON.stringify(task.processor)); 
  mergedTask["command"] = "update";
  // Because this is a fresh command sent from the coprocessor not part of the coprocessing pipeline
  mergedTask.processor["coprocessing"] = false;
  // Because it is this processor that is the initiator
  mergedTask.processor["initiatingProcessorId"] = processorId; //"coprocessor";
  try {
    //utils.logTask(task, "commandUpdate_async mergedTask.state", mergedTask.state);
    wsSendTask(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
