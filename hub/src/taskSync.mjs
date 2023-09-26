/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTaskProcessorsStore_async, activeProcessors, activeCoprocessors, getActiveTask_async } from "./storage.mjs";
import { wsSendTask } from "./webSocket.js";
import { utils } from "./utils.mjs";
import { haveCoprocessor } from "../config.mjs";

let broadcastCount = 0;

const taskSync_async = async (key, value) => {

  //utils.logTask(value, "taskSync_async", key, value.processor)

  if (value.meta) {
    value.meta.lastUpdatedAt = value.meta.updatedAt;
    value.meta.updatedAt = utils.updatedAt();
  }

  // key may be undefined if this is a start task that is being forwarded to coprocessor
  // A start command could arrive without familyId set on the value and this would lose
  // failyId which created other issues with loading the prevInstanceId in taskStart
  if (key && value.hub.command != "start") {
    utils.logTask(value, "taskSync_async familyId", value.familyId, value.hub.command);
  } else if (!haveCoprocessor) {
    throw new Error("taskSync_async missing key" + JSON.stringify(value));
  }

  const activeTask = await getActiveTask_async(value.instanceId);

  // We store excatly what was sent to us
  const taskCopy = utils.deepClone(value); //deep copy
  let sourceProcessorId = taskCopy.hub.sourceProcessorId;
  // Config can be missing from a start task
  if (!sourceProcessorId && !taskCopy?.autoStart) {
    throw new Error("taskSync_async missing sourceProcessorId" + JSON.stringify(taskCopy));
  }
  if (!taskCopy?.hub?.command) {
    throw new Error("taskSync_async missing command" + JSON.stringify(taskCopy));
  }
  let command = taskCopy.hub.command;

  const coprocessorIds = Array.from(activeCoprocessors.keys());
  const isCoprocessor = coprocessorIds.includes(sourceProcessorId);
  const skipCoProcessingCommands = ["partial"];
  const skipCoProcessing = skipCoProcessingCommands.includes(command);
  
  // Pass to the first co-processor if we should coprocess first
  // Maybe isCoprocessor is redundant given that we set hub.coprocessing
  // Update commands with sync option from the coprocessor will be skipped because of isCoprocessor
  if (haveCoprocessor && !isCoprocessor && !taskCopy.hub.coprocessing && !taskCopy.hub.coprocessingDone && !skipCoProcessing) {
    utils.logTask(taskCopy, "Start coprocessing");
    // Start Co-Processing
    // Send to the first Coprocessor that supports the command 
    let position = 0;
    for (const coprocessorId of coprocessorIds) { 
      const coprocessorData = activeCoprocessors.get(coprocessorId);
      if (coprocessorData.commandsAccepted.includes(command)) {
        taskCopy.hub.coprocessingPosition = position;
        utils.logTask(taskCopy, "taskSync_async coprocessor initiate", command, key, coprocessorId, taskCopy.hub.initiatingProcessorId);
        if (!taskCopy.processors) {
          taskCopy.processors = {};
        }
        if (!taskCopy.processors[coprocessorId]) {
          taskCopy.processors[coprocessorId] = {id: coprocessorId, isCoprocessor: true};
        }
        taskCopy.hub["coprocessing"] = true;
        taskCopy.hub["coprocessingDone"] = false;
        wsSendTask(taskCopy, coprocessorId, activeTask);
        break;
      } else {
        //utils.logTask(taskCopy, "CoProcessor does not support commmand", command, coprocessorId);
      }
      position++;
    }
    // Return because we need to wait for coprocessor result before forwarind on via sync
    return value;
  }

  taskCopy.hub.coprocessing = false;

  // Every coprocssor needs to be updated/synced
  if (coprocessorIds) {
    for (const coprocessorId of coprocessorIds) {
      if (command === "join") {
        continue;
      }
      const coprocessorData = activeCoprocessors.get(coprocessorId);
      if (coprocessorData) {
        if (coprocessorData.commandsAccepted.includes(command)) {
          utils.logTask(taskCopy, "taskSync_async coprocessor", command, " sent to coprocessor " + coprocessorId);
          wsSendTask(taskCopy, coprocessorId, activeTask);
        } else {
          //utils.logTask(taskCopy, "taskSync_async coprocessor does not support commmand", command, coprocessorId);
        }
      }
    }
  }

  //  We do not want coprocessingDone passed on to child tasks
  taskCopy.hub.coprocessingDone = false;

  const initiatingProcessorId = taskCopy.hub.initiatingProcessorId || sourceProcessorId;
  taskCopy.hub.sourceProcessorId = initiatingProcessorId

  taskCopy.meta.broadcastCount = broadcastCount;
  broadcastCount++;
  // foreach processorId in processorIds send the task to the processor
  const processorIds = await activeTaskProcessorsStore_async.get(key);
  if (processorIds) {
    //utils.logTask(taskCopy, "taskSync_async task " + taskCopy.id + " from " + initiatingProcessorId);
    let updatedProcessorIds = [...processorIds]; // Make a copy of processorIds
    for (const processorId of processorIds) {
      if (command === "join" && processorId !== initiatingProcessorId) {
        continue;
      }
      const processorData = activeProcessors.get(processorId);
      if (processorData) {
        if (!taskCopy.processors) {
          utils.logTask(taskCopy, "taskCopy missing processors", command );
        }
        if (!taskCopy.processors[processorId]) {
          utils.logTask(taskCopy, "taskCopy missing processor", command, processorId );
        }
        if (processorData.commandsAccepted.includes(command)) {
          const statesSupported = taskCopy.processors[processorId].statesSupported;
          const statesNotSupported = taskCopy.processors[processorId].statesNotSupported;
          const state = taskCopy.state.current;
          if (!statesSupported || statesSupported.includes(state)) {
            if (!statesNotSupported || !statesNotSupported.includes(state)) {
              utils.logTask(taskCopy, "taskSync_async", command, key, processorId);
              wsSendTask(taskCopy, processorId, activeTask);
            } else {
              utils.logTask(taskCopy, `taskSync_async processor:${processorId} state:${state} in statesNotSupported:${statesNotSupported}`);
            }
          } else {
            utils.logTask(taskCopy, `taskSync_async processor:${processorId} state:${state} not in statesSupported:${statesSupported}`);
          }
        } else {
          //utils.logTask(taskCopy, "taskSync_async processor does not support commmand", command, processorId);
        }
      } else {
        updatedProcessorIds = updatedProcessorIds.filter(id => id !== processorId);
        utils.logTask(taskCopy, `Processor ${processorId} not found in active processors. It will be removed from activeTaskProcessorsStore_async`);
      }
    }
    // Update activeTaskProcessorsStore_async with the updatedProcessorIds only if the processors have changed
    if (processorIds.length !== updatedProcessorIds.length) {
      await activeTaskProcessorsStore_async.set(key, updatedProcessorIds);
    }
  } else {
    utils.logTask(taskCopy, "taskSync_async no activeTaskProcessors available", key, value);
  }
  //utils.logTask(taskCopy, "taskSync_async after", key, value.processor);
  return value;

};

export default taskSync_async;