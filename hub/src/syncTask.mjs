/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, activeTaskProcessorsStore_async, instancesStore_async, activeProcessors, activeCoProcessors } from "./storage.mjs";
import { wsSendTask } from "./websocket.js";
import { utils } from "./utils.mjs";

let broadcastCount = 0;

const syncTask_async = async (key, value) => {

  //console.log("syncTask_async", key, value.processor)
  await instancesStore_async.set(key, value);

  // We store excatly what was sent to us
  const taskCopy = JSON.parse(JSON.stringify(value)); //deep copy
  let sourceProcessorId = taskCopy.hub.sourceProcessorId;
  if (!sourceProcessorId) {
    throw new Error("syncTask_async missing sourceProcessorId" + JSON.stringify(taskCopy));
  }
  const has = await activeTasksStore_async.has(key);
  if (!taskCopy?.hub?.command) {
    throw new Error("syncTask_async missing command" + JSON.stringify(taskCopy));
  }
  let command = taskCopy.hub.command;
  let commandArgs = taskCopy.hub.commandArgs;
  if (has) {
    if (command === "join") {
      commandArgs = { ...commandArgs, ...{ lockBypass: true } };
    } else if (command === "update") {
      taskCopy.meta.updatedAt = utils.updatedAt();
    }
  }

  const coProcessorIds = Array.from(activeCoProcessors.keys());
  const isCoProcessor = coProcessorIds.includes(sourceProcessorId);
  const haveCoProcessor = coProcessorIds.length > 0;

  // Pass to the first co-processor if we should coprocess first
  if (haveCoProcessor && !isCoProcessor && !taskCopy.hub.coProcessing && !taskCopy.hub.coProcessingDone) {
    console.log("Start coprocessing");
    // Start Co-Processing
    // Send to the first Co-Processor that supports the command 
    let position = 0;
    for (const coProcessorId of coProcessorIds) { 
      const coProcessorData = activeCoProcessors.get(coProcessorId);
      if (coProcessorData.commandsAccepted.includes(command)) {
        taskCopy.hub.coProcessorPosition = position;
        console.log("syncTask_async coprocessor initiate", command, key, coProcessorId, taskCopy.hub.initiatingProcessorId);
        if (!taskCopy.processors[coProcessorId]) {
          taskCopy.processors[coProcessorId] = {id: coProcessorId, isCoProcessor: true};
          value.processors[coProcessorId] = {id: coProcessorId, isCoProcessor: true}; // Note this impacts the return value!!
        }
        taskCopy.processors[coProcessorId]["coProcessing"] = true;
        taskCopy.processors[coProcessorId]["coProcessingDone"] = false;
        wsSendTask(taskCopy, coProcessorId);
        break;
      } else {
        console.log("CoProcessor does not support commmand", command, coProcessorId);
      }
      position++;
    }
    // Return because we need to wait for coprocessor result before forwarind on via sync
    return value;
  }

  value.hub.coProcessing = false; // Note this impacts the return value!! Do we need this?
  taskCopy.hub.coProcessing = false;

  // Every coprocssor needs to be updated/synced
  if (coProcessorIds) {
    for (const coProcessorId of coProcessorIds) {
      if (command === "join") {
        continue;
      }
      const coProcessorData = activeCoProcessors.get(coProcessorId);
      if (coProcessorData) {
        if (coProcessorData.commandsAccepted.includes(command)) {
          console.log("syncTask_async coprocessor", command, key, coProcessorId);
          wsSendTask(taskCopy, coProcessorId);
        } else {
          console.log("syncTask_async coprocessor does not support commmand", command, coProcessorId);
        }
      }
    }
  }

  const initiatingProcessorId = taskCopy.hub.initiatingProcessorId || sourceProcessorId;
  taskCopy.hub.sourceProcessorId = initiatingProcessorId

  taskCopy.meta.broadcastCount = broadcastCount;
  broadcastCount++;
  // foreach processorId in processorIds send the task to the processor
  const processorIds = await activeTaskProcessorsStore_async.get(key);
  if (processorIds) {
    //console.log("syncTask_async task " + taskCopy.id + " from " + initiatingProcessorId);
    let updatedProcessorIds = [...processorIds]; // Make a copy of processorIds
    for (const processorId of processorIds) {
      if (command === "join" && processorId !== initiatingProcessorId) {
        continue;
      }
      const processorData = activeProcessors.get(processorId);
      if (processorData) {
        if (!taskCopy.processors) {
          console.log("taskCopy missing processors", command );
        }
        if (!taskCopy.processors[processorId]) {
          console.log("taskCopy missing processor", command, processorId );
        }
        if (processorData.commandsAccepted.includes(command)) {
          console.log("syncTask_async", command, key, processorId);
          wsSendTask(taskCopy, processorId);
        } else {
          console.log("syncTask_async processor does not support commmand", command, processorId);
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
    console.log("syncTask_async no processorIds", key, value);
  }
  //console.log("syncTask_async after", key, value.processor);
  return value;

};

export default syncTask_async;