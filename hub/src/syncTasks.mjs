/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, activeTaskProcessorsStore_async, instancesStore_async, activeProcessors } from "./storage.mjs";
import { wsSendTask } from "./websocket.js";
import { utils } from "./utils.mjs";

const syncTasks_async = async (key, value) => {

  //console.log("syncTasks_async", key, value.processor)
  await instancesStore_async.set(key, value);

  // So we store excatly what was sent to us
  const taskCopy = JSON.parse(JSON.stringify(value)); //deep copy
  const has = await activeTasksStore_async.has(key);
  let command = taskCopy.processor[taskCopy.source].command
  if (has) {
    if (command === "join") {
      taskCopy.lockBypass = true;
      delete value.join; // should not be using task for internal Hub communication
      delete taskCopy.join
    } else if (command === "update") {
      taskCopy.meta.updatedAt = utils.updatedAt();
    }
   }
  // foreach processorId in processorIds send the task to the processor
  // foreach processorId in processorIds send the task to the processor
  const processorIds = await activeTaskProcessorsStore_async.get(key);
  if (processorIds) {
    console.log("syncTasks_async task " + taskCopy.id + " from " + taskCopy.source);
    let updatedProcessorIds = [...processorIds]; // Make a copy of processorIds
    for (const processorId of processorIds) {
      const processorData = activeProcessors.get(processorId);
      if (processorData) {
        if ((processorId !== taskCopy.source && command !== "join") 
            || command === "start" || command === "next"
            || (command === "join" && processorId === taskCopy.source)
        ) {
          if (!taskCopy.processor[processorId]) {
            console.log("command taskCopy ", command, taskCopy, processorId );
          }
          taskCopy.processor[processorId]["command"] = command;
          //console.log("syncTasks_async", command, key, processorId, taskCopy.processor);
          await wsSendTask(taskCopy, processorId);
        } else {
          //console.log("syncTasks_async skipping", key, processorId);
        }
      } else {
        updatedProcessorIds = updatedProcessorIds.filter(id => id !== processorId);
        console.log(`Processor ${processorId} not found in active processors. It will be removed from activeTaskProcessorsStore_async`);
      }
    }
    // Update activeTaskProcessorsStore_async with the updatedProcessorIds only if the processors have changed
    if (processorIds.length !== updatedProcessorIds.length) {
      await activeTaskProcessorsStore_async.set(key, updatedProcessorIds);
    }
  } else {
    console.log("syncTasks_async no processorIds", key, value);
  }
  //console.log("syncTasks_async after", key, value.processor);
  return value;

};

export default syncTasks_async;