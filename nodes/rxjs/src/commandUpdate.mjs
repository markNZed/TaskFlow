/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { getActiveTask_async } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { NODE } from "../config.mjs";
import { taskLock } from './shared/taskLock.mjs';

export async function commandUpdate_async(wsSendTask, task) {
  utils.debugTask(task);
  utils.logTask(task, "commandUpdate_async instanceId:", task.instanceId, "commandArgs:", task.commandArgs, "commandDescription:", task.commandDescription);
  //utils.logTask(task, "commandUpdate_async sync node", lastTask.node);
  let mergedTask = {}
  // Deep copy task.node to avoif changes to task that was passed in
  const commandArgs = task.commandArgs || {};
  const commandDescription = task.commandDescription || "";
  const sync = commandArgs.sync;
  const syncInstanceId = commandArgs.instanceId;
  if (sync) {
    if (!syncInstanceId) {
      console.error("Missing syncInstanceId", task);
      throw new Error("Missing syncInstanceId");
    }
    // Dont release lock here as we need o wait for the update to be returned by the Hub
    await taskLock(syncInstanceId, "commandUpdate_async " + commandDescription);
    mergedTask["instanceId"] = syncInstanceId;
    mergedTask["command"] = "update";
    mergedTask["commandArgs"] = commandArgs;
    mergedTask.commandArgs["lockBypass"] = true; // Could enforce this on the hub when sync is true"]
    mergedTask["meta"] = {};
    mergedTask.node = utils.deepClone(NODE);
    mergedTask.node["coprocessed"] = true; // So sync is not coprocessed again, it can still be logged
  } else {
    utils.logTask(task, "commandUpdate_async requesting lock for update", task.instanceId);
    await taskLock(task.instanceId, "commandUpdate_async " + commandDescription);
    const lastTask = await getActiveTask_async(task.instanceId);
    if (!lastTask) {
      throw new Error("No lastTask found for " + task.instanceId);
    }
    mergedTask = utils.deepMerge(lastTask, task);
    mergedTask.node = utils.deepClone(task.node);
    mergedTask.node["coprocessed"] = false;
  } 
  mergedTask["command"] = "update";
  mergedTask["commandDescription"] = commandDescription;
  // Because this is a fresh command sent from the coprocessor not part of the coprocessing pipeline
  mergedTask.node["coprocessing"] = false;
  // Because it is this node that is the initiator
  mergedTask.node["initiatingNodeId"] = NODE.id; //"coprocessor";
  try {
    await wsSendTask(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
