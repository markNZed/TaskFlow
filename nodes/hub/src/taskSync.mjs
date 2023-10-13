/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTaskNodesStore_async, activeNodes, getActiveTask_async } from "./storage.mjs";
import { wsSendTask } from "./webSocket.js";
import { utils } from "./utils.mjs";
import { NODE } from "../config.mjs";

let broadcastCount = 0;

const taskSync_async = async (key, value) => {

  if (value.meta) {
    value.meta.lastUpdatedAt = value.meta.updatedAt;
    value.meta.updatedAt = utils.updatedAt();
  }

  // key may be undefined if this is a start task that is being forwarded to coprocessor
  // A start command could arrive without familyId set on the value and this would lose
  // failyId which created other issues with loading the prevInstanceId in taskStart
  if (key && value.hub.command != "start") {
    utils.logTask(value, "taskSync_async familyId", value.familyId, value.hub.command);
  } else if (!NODE.haveCoprocessor) {
    throw new Error("taskSync_async missing key" + JSON.stringify(value));
  }

  const activeTask = await getActiveTask_async(value.instanceId);

  // We store excatly what was sent to us
  const taskCopy = utils.deepClone(value); //deep copy
  let sourceNodeId = taskCopy.hub.sourceNodeId;
  // Config can be missing from a start task
  if (!sourceNodeId) {
    throw new Error("taskSync_async missing sourceNodeId" + JSON.stringify(taskCopy));
  }
  if (!taskCopy?.hub?.command) {
    throw new Error("taskSync_async missing command" + JSON.stringify(taskCopy));
  }
  let command = taskCopy.hub.command;

  // In reality there is one coprocessor we should cache this info
  const coprocessorIds = [];
  activeNodes.forEach((value, key) => {
    if (value.role === 'coprocessor') {
      coprocessorIds.push(key);
    }
  });
  // Should only have max one coprocessor
  if (coprocessorIds.length > 1) {
    throw new Error("taskSync_async more than one coprocessor" + JSON.stringify(taskCopy));
  }
  let coprocessorId = coprocessorIds[0];
  let coprocessorData = activeNodes.get(coprocessorId);
  let coprocessCommand;
  if (coprocessorData) {
    coprocessCommand = coprocessorData.commandsAccepted.includes(command)
  }
    
  // Pass to the first coprocessor if we should coprocess first
  if (coprocessorData && coprocessCommand && !taskCopy.hub.coprocessing && !taskCopy.hub.coprocessed ) {
    utils.logTask(taskCopy, "Start coprocessing");
    // Start Co-Processing
    utils.logTask(taskCopy, "taskSync_async coprocessor initiate", command, key, coprocessorId, taskCopy.hub.initiatingNodeId);
    if (!taskCopy.nodes) {
      taskCopy.nodes = {};
    }
    if (!taskCopy.nodes[coprocessorId]) {
      taskCopy.nodes[coprocessorId] = coprocessorData;
    }
    taskCopy.hub["coprocessing"] = true;
    taskCopy.hub["coprocessed"] = false;
    wsSendTask(taskCopy, coprocessorId, activeTask);
    // Return because we need to wait for coprocessor result before forwarding on via sync
    return value;
  }

  taskCopy.hub.coprocessing = false;

  // Every coprocessor needs to be updated/synced
  if (coprocessorData && coprocessCommand) {
    //utils.logTask(taskCopy, "taskSync_async sending", command, "sent to coprocessor", coprocessorId);
    wsSendTask(taskCopy, coprocessorId, activeTask);
  }

  // Every type: "hub", role: "consumer" needs to be updated/synced
  const activeNodeIds = Array.from(activeNodes.keys());
  const hubConsumerIds = activeNodeIds.filter(nodeId => {
    const nodeData = activeNodes.get(nodeId);
    return nodeData?.role === "consumer" && nodeData?.type === "hub";
  })
  if (hubConsumerIds) {
    for (const hubConsumerId of hubConsumerIds) {
      const nodeData = activeNodes.get(hubConsumerId);
      if (nodeData) {
        if (nodeData.commandsAccepted.includes(command)) {
          //utils.logTask(taskCopy, "taskSync_async sending", command, "sent to hub consumer", hubConsumerId);
          wsSendTask(taskCopy, hubConsumerId, activeTask);
        } else {
          //utils.logTask(taskCopy, "taskSync_async coprocessor does not support commmand", command, hubConsumerId);
        }
      }
    }
  }

  //  We do not want coprocessed passed on to child tasks
  taskCopy.hub.coprocessed = false;

  const initiatingNodeId = taskCopy.hub.initiatingNodeId || sourceNodeId;
  taskCopy.hub.sourceNodeId = initiatingNodeId

  taskCopy.meta.broadcastCount = broadcastCount;
  broadcastCount++;
  // foreach nodeId in nodeIds send the task to the node
  const nodeIds = await activeTaskNodesStore_async.get(key);
  if (nodeIds) {
    //utils.logTask(taskCopy, "taskSync_async task " + taskCopy.id + " from " + initiatingNodeId);
    let updatedNodeIds = [...nodeIds]; // Make a copy of nodeIds
    for (const nodeId of nodeIds) {
      // Don't update self
      if (nodeId === NODE.id) {
        continue;
      }
      // Hub consumers have already been updated
      if (hubConsumerIds.includes(nodeId)) {
        continue;
      }
      // Hub coprocessors have already been updated
      if (coprocessorIds.includes(nodeId)) {
        continue;
      }
      if (command === "join" && nodeId !== initiatingNodeId) {
        continue;
      }
      const nodeData = activeNodes.get(nodeId);
      if (nodeData) {
        if (!taskCopy.nodes) {
          utils.logTask(taskCopy, "taskCopy missing nodes", command );
        }
        if (!taskCopy.nodes[nodeId]) {
          utils.logTask(taskCopy, "taskCopy missing node", nodeId, "initiatingNodeId", initiatingNodeId, "command", command);
        }
        if (nodeData.commandsAccepted.includes(command)) {
          const statesSupported = taskCopy.nodes[nodeId].statesSupported;
          const statesNotSupported = taskCopy.nodes[nodeId].statesNotSupported;
          const state = taskCopy.state.current;
          if (!statesSupported || statesSupported.includes(state)) {
            if (!statesNotSupported || !statesNotSupported.includes(state)) {
              //utils.logTask(taskCopy, "taskSync_async sending", command, key, nodeId);
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
        utils.logTask(taskCopy, `Node ${nodeId} not found in active nodes. It will be removed from activeTaskNodesStore_async`);
      }
    }
    // Update activeTaskNodesStore_async with the updatedNodeIds only if the nodes have changed
    if (nodeIds.length !== updatedNodeIds.length) {
      await activeTaskNodesStore_async.set(key, updatedNodeIds);
    }
  } else {
    utils.logTask(taskCopy, "taskSync_async no activeTaskNodes available", key, value);
  }
  return value;

};

export default taskSync_async;