/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, activeProcessorsStore_async } from "./storage.mjs";
import { wsSendObject } from "./websocket.js";
import { utils } from "./utils.mjs";

const syncTasks_async = async (key, value) => {

  //console.log("syncTasks_async", key)

  const task = value
  const has = await activeTasksStore_async.has(key);
  let diff = {}
  let command;
  if (has) { 
    const activeTask = await activeTasksStore_async.get(key);
    if (activeTask.instanceId !== task.instanceId) {
      throw new Error("instanceId mismatch " + JSON.stringify(activeTask) + " " + task.instanceId);
    }
    //console.log("syncTasks_async activeTask", activeTask, "task", task );
    diff = utils.getObjectDifference(task, activeTask); // favour task
    if (Object.keys(diff).length === 0) {
      console.log("syncTasks_async no diff", diff);
      return null;
    }
    diff.instanceId = task.instanceId;
    diff.stackPtr = task.stackPtr;
    command = "update"
    console.log("syncTasks_async diff", diff);
  } else {
    diff = task;
    command = "start"
  }
  // foreach processorId in processorIds send the task to the processor
  const processorIds = await activeProcessorsStore_async.get(key);
  if (processorIds) {
    console.log("syncTasks_async task " + task.id + " from " + task.source);
    for (const processorId of processorIds) {
      if (processorId !== task.source) {
        const message = { command: command, task: diff };
        wsSendObject(processorId, message);
        //console.log("syncTasks_async updating", key, processorId);
      } else {
        //console.log("syncTasks_async skipping", key, processorId);
      }
    }
  } else {
    console.log("syncTasks_async no processorIds", key, value);
  }
  //console.log("syncTasks_async", key, value);
  return value;

};

export default syncTasks_async;