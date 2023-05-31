/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, activeTaskProcessorsStore_async, instancesStore_async } from "./storage.mjs";
import { wsSendTask } from "./websocket.js";

const syncTasks_async = async (key, value) => {

  //console.log("syncTasks_async", key)
  await instancesStore_async.set(value.instanceId, value);

  // So we store excatly what was sent to us
  const taskCopy = JSON.parse(JSON.stringify(value)); //deep copy
  const has = await activeTasksStore_async.has(key);
  let command;
  if (has) { 
    command = "update"
   } else {
    command = "start"
  }
  // foreach processorId in processorIds send the task to the processor
  const processorIds = await activeTaskProcessorsStore_async.get(key);
  if (processorIds) {
    console.log("syncTasks_async task " + taskCopy.id + " from " + taskCopy.source);
    for (const processorId of processorIds) {
      if (processorId !== taskCopy.source) {
        taskCopy.destination = processorId;
        wsSendTask(taskCopy, command);
        console.log("syncTasks_async", command, key, processorId);
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