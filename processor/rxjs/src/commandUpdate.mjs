/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { getActiveTask_async } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { processorId, COPROCESSOR } from "../config.mjs";
import { taskLock } from './shared/taskLock.mjs';

export async function commandUpdate_async(wsSendTask, task, diff, sync = false) { 
  utils.logTask(task, "commandUpdate_async task.instanceId:", task.instanceId, "diff.instanceId:", diff?.instanceId, "sync:", sync);
  //utils.logTask(task, "commandUpdate_async sync processor", lastTask.processor);
  let mergedTask = {}
  // Deep copy task.processor to avoif changes to task that was passed in
  if (sync) {
    if (!diff.instanceId) {
      console.log("commandUpdate_async assuming that we are syncing self")
      diff["instanceId"] = task.instanceId
    }
    await taskLock(diff.instanceId, "commandUpdate_async");
    mergedTask["instanceId"] = diff["instanceId"]
    mergedTask["command"] = "update";
    mergedTask["commandArgs"] = {
      syncTask: JSON.parse(JSON.stringify(diff)),
      sync: true,
      lockBypass: true, // Could enforce this on the hub when sync is true
    };
    //delete mergedTask.commandArgs.syncTask.command;
    //delete mergedTask.commandArgs.syncTask.commandArgs;
    mergedTask["meta"] = {};
    mergedTask["processor"] = {};
    mergedTask.processor["coprocessingDone"] = true; // So sync is not coprocessed again, it can still be logged
  } else {
    utils.logTask(task, "commandUpdate_async requesting lock for update", task.instanceId);
    await taskLock(task.instanceId, "commandUpdate_async");
    const lastTask = await getActiveTask_async(task.instanceId);
    if (!lastTask) {
      throw new Error("No lastTask found for " + task.instanceId);
    }
    mergedTask = utils.deepMerge(lastTask, task);
    mergedTask.processor = JSON.parse(JSON.stringify(task.processor));
    mergedTask.processor["coprocessingDone"] = false;
  } 
  mergedTask["command"] = "update";
  // Because this is a fresh command sent from the coprocessor not part of the coprocessing pipeline
  mergedTask.processor["coprocessing"] = false;
  // Because it is this processor that is the initiator
  mergedTask.processor["initiatingProcessorId"] = processorId; //"coprocessor";
  try {
    //utils.logTask(task, "commandUpdate_async mergedTask.state", mergedTask.state);
    if (COPROCESSOR) {
      mergedTask.meta["prevMessageId"] = mergedTask.meta.messageId;
      mergedTask.meta["messageId"] = utils.nanoid8();
      utils.logTask(task, "Creating new messageId from coprocessor", mergedTask.meta.messageId);
    }
    //utils.logTask(task, "wsSendTask");
    wsSendTask(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
