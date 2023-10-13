/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { setActiveTask_async } from "./storage.mjs";
import taskSync_async from "./taskSync.mjs";
import { taskRelease } from './shared/taskLock.mjs';

export async function commandJoin_async(task) {
  utils.debugTask(task);
  let nodeId = task.node.sourceNodeId;
  try {
    utils.logTask(task, "commandJoin_async id:" + task.id + " from nodeId:" + nodeId);
    await taskSync_async(task.instanceId, task);
    await utils.nodeActiveTasksStoreSet_async(setActiveTask_async, task);
    taskRelease(task.instanceId, "commandJoin_async");
  } catch (error) {
    const msg = `Error commandJoin_async task ${task.id}: ${error.message}`;
    console.error(msg);
    throw error;
  }
  
}
