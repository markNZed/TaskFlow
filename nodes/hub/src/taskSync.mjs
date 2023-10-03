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

  //utils.logTask(value, "taskSync_async", key, value.node)

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
  const skipCoProcessingCommands = ["partial"];
  const skipCoProcessing = skipCoProcessingCommands.includes(command);
  
  // Pass to the first coprocessor if we should coprocess first
  // Maybe isCoprocessor is redundant given that we set hub.coprocessing
  // Update commands with sync option from the coprocessor will be skipped because of isCoprocessor
  if (haveCoprocessor && !taskCopy.hub.coprocessing && !taskCopy.hub.coprocessingDone && !skipCoProcessing) {
    utils.logTask(taskCopy, "Start coprocessing");
    // Start Co-Processing
    // Send to the first Coprocessor that supports the command 
    let position = 0;
    for (const coprocessorId of coprocessorIds) { 
      const coprocessorData = activeCoprocessors.get(coprocessorId);
      if (coprocessorData.commandsAccepted.includes(command)) {
        taskCopy.hub.coprocessingPosition = position;
        utils.logTask(taskCopy, "taskSync_async coprocessor initiate", command, key, coprocessorId, taskCopy.hub.initiatingProcessorId);
        if (!taskCopy.nodes) {
          taskCopy.nodes = {};
        }
        if (!taskCopy.nodes[coprocessorId]) {
          taskCopy.nodes[coprocessorId] = {id: coprocessorId, isCoprocessor: true};
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

  // Every coprocessor needs to be updated/synced
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

  // Every type: "hub", role: "consumer" needs to be updated/synced
  const activeProcessorIds = Array.from(activeProcessors.keys());
  const hubConsumerIds = activeProcessorIds.filter(nodeId => {
    const nodeData = activeProcessors.get(nodeId);
    return nodeData?.role === "consumer" && nodeData?.type === "hub";
  })
  if (hubConsumerIds) {
    for (const hubConsumerId of hubConsumerIds) {
      if (command === "join") {
        continue;
      }
      const nodeData = activeProcessors.get(hubConsumerId);
      if (nodeData) {
        if (nodeData.commandsAccepted.includes(command)) {
          utils.logTask(taskCopy, "taskSync_async hub consumer", command, " sent to node " + hubConsumerId);
          wsSendTask(taskCopy, hubConsumerId, activeTask);
        } else {
          //utils.logTask(taskCopy, "taskSync_async coprocessor does not support commmand", command, hubConsumerId);
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
  // foreach nodeId in nodeIds send the task to the node
  const nodeIds = await activeTaskProcessorsStore_async.get(key);
  if (nodeIds) {
    //utils.logTask(taskCopy, "taskSync_async task " + taskCopy.id + " from " + initiatingProcessorId);
    let updatedNodeIds = [...nodeIds]; // Make a copy of nodeIds
    for (const nodeId of nodeIds) {
      // Hub consumers have already been updated
      if (hubConsumerIds.includes(nodeId)) {
        continue;
      }
      if (command === "join" && nodeId !== initiatingProcessorId) {
        continue;
      }
      const nodeData = activeProcessors.get(nodeId);
      if (nodeData) {
        if (!taskCopy.nodes) {
          utils.logTask(taskCopy, "taskCopy missing nodes", command );
        }
        if (!taskCopy.nodes[nodeId]) {
          utils.logTask(taskCopy, "taskCopy missing node", command, nodeId );
        }
        if (nodeData.commandsAccepted.includes(command)) {
          const statesSupported = taskCopy.nodes[nodeId].statesSupported;
          const statesNotSupported = taskCopy.nodes[nodeId].statesNotSupported;
          const state = taskCopy.state.current;
          if (!statesSupported || statesSupported.includes(state)) {
            if (!statesNotSupported || !statesNotSupported.includes(state)) {
              utils.logTask(taskCopy, "taskSync_async", command, key, nodeId);
              wsSendTask(taskCopy, nodeId, activeTask);
            } else {
              utils.logTask(taskCopy, `taskSync_async node:${nodeId} state:${state} in statesNotSupported:${statesNotSupported}`);
            }
          } else {
            utils.logTask(taskCopy, `taskSync_async node:${nodeId} state:${state} not in statesSupported:${statesSupported}`);
          }
        } else {
          //utils.logTask(taskCopy, "taskSync_async node does not support commmand", command, nodeId);
        }
      } else {
        updatedNodeIds = updatedNodeIds.filter(id => id !== nodeId);
        utils.logTask(taskCopy, `Processor ${nodeId} not found in active nodes. It will be removed from activeTaskProcessorsStore_async`);
      }
    }
    // Update activeTaskProcessorsStore_async with the updatedNodeIds only if the nodes have changed
    if (nodeIds.length !== updatedNodeIds.length) {
      await activeTaskProcessorsStore_async.set(key, updatedNodeIds);
    }
  } else {
    utils.logTask(taskCopy, "taskSync_async no activeTaskProcessors available", key, value);
  }
  //utils.logTask(taskCopy, "taskSync_async after", key, value.node);
  return value;

};

export default taskSync_async;