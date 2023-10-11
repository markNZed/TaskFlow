/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, activeTaskProcessorsStore_async, activeProcessorTasksStore_async, activeProcessors, activeCoprocessors } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { commandUpdate_async } from "./commandUpdate.mjs";
import { commandStart_async } from "./commandStart.mjs";
import { commandInit_async } from "./commandInit.mjs";
import { commandError_async } from "./commandError.mjs";
import { taskProcess_async } from "./taskProcess.mjs";
import { commandJoin_async } from "./commandJoin.mjs";

/**
 * Sends an object through the WebSocket connection identified by the given node ID.
 *
 * @param {string} nodeId - The ID of the WebSocket connection to use.
 * @param {Object} [message={}] - The object to send through the connection.
 * @throws {Error} If the message object does not have a task property.
 */
function wsSendObject(nodeId, message = {}) {
  const ws = connections.get(nodeId);
  if (!ws) {
    console.error(`Lost websocket for wsSendObject with nodeId ${nodeId} and message task ${message.task}`);
  } else {
    ws.send(JSON.stringify(message));
    if (message.task.hub.command !== "pong") {
      //console.log("wsSendObject message.task.output.sending", message.task?.output?.sending);
      //console.log("wsSendObject ", nodeId, message.task.node )
    }
  }
}

const wsSendTask = async function (taskIn, nodeId, activeTask) {
  utils.debugTask(taskIn, "input");
  const currentNode = utils.deepClone(taskIn.hub);
  if (!currentNode?.command) {
    throw new Error("Missing command in wsSendTask" + JSON.stringify(taskIn));
  }
  //console.log("wsSendTask task.request", task.request)
  let task = utils.deepClone(taskIn); //deep copy because we make changes e.g. task.node
  // hubDiff will remove nodes and users
  let outgoingNode;
  if (task.nodes && task.nodes[nodeId]) {
    outgoingNode = JSON.parse(JSON.stringify(task.nodes[nodeId]));
  }
  let user;
  if (task.user && task.users && task.user.id && task.users[task.user.id]) {
    user = JSON.parse(JSON.stringify(task.users[task.user.id]));
  }
  let message = {}
  // We can only have an activeTask for an update command
  if (currentNode.command === "update") {
    //utils.logTask(task, "wsSendTask " + command + " activeTask state", activeTask.state);
    //utils.logTask(task, "wsSendTask " + command + " task state", task.state);
    const statesSupported = outgoingNode?.statesSupported
    const statesNotSupported = outgoingNode?.statesNotSupported
    let diff = {}
    if (activeTask) {
      // If only some states are supported then the task storage may be out of sync so send the entire object
      // We could potentially have storage on the currentNode for the task on the outgoingNode in this case 
      if (statesSupported || statesNotSupported) {
        //console.log("wsSendTask statesSupported", task.state.current, outgoingNode);
        diff = task;
      } else {
        diff = utils.hubDiff(activeTask, task);
      }
      if (Object.keys(diff).length === 0) {
        utils.logTask(task, "wsSendTask no diff", diff);
        return null;
      }
      task = diff;
    } else {
      throw new Error("Update but no active task for " + task.id);
    }
  }
  //utils.logTask(task, "wsSendTask " + command + " message state", message["task"].state);
  // For example task.command === "partial" does not have task.nodes
  //utils.logTask(task, "wsSendTask currentNode", currentNode);
  if (outgoingNode) {
    //utils.logTask(task, "wsSendTask task.nodes", nodeId, task.nodes);
    //deep copy because we are going to edit the object
    task["node"] = outgoingNode;
    task.node["command"] = null;
    task.node["commandArgs"] = null;
    delete task.nodes;
  } else {
    task.node = {};
  }
  const { coprocessingPosition, coprocessing, coprocessingDone, initiatingNodeId, sourceProcessorId } = currentNode;
  if (task.node.isCoprocessor) {
    task.node["coprocessingPosition"] = coprocessingPosition;
    task.node["coprocessing"] = coprocessing;
    task.node["coprocessingDone"] = coprocessingDone;
  }
  task.node["initiatingNodeId"] = initiatingNodeId;
  task.node["sourceProcessorId"] = sourceProcessorId;
  if (user) {
    if (!task?.user?.id) {
      utils.logTask(task, "wsSendTask no user", task);
    }
    task["user"] = user;
    delete task.users;
  }
  task.meta = task.meta || {};
  if (currentNode.command !== "pong") {
    //utils.logTask(task, "wsSendTask sourceProcessorId " + currentNode.sourceProcessorId)
    //utils.logTask(task, "wsSendTask task " + (task.id || task.instanceId )+ " to " + nodeId)
    //utils.logTask(task, "wsSendTask currentNode.commandArgs.sync", currentNode?.commandArgs?.sync);
  }
  message["task"] = task;
  //utils.logTask(task, "wsSendTask task.node.stateLast", task.node.stateLast, task.node.id);
  utils.debugTask(task, "output");
  wsSendObject(nodeId, message);
}

function initWebSocketServer(server) {

  const websocketServer = new WebSocketServer({ server: server, path: "/hub/ws" });

  websocketServer.on("connection", (ws, req) => {
    // Accessing headers from the request (req) object
    const userId = utils.getUserId(req);
    console.log("websocketServer.on");

    ws.data = { nodeId: undefined };

    ws.on("message", async (message) => {

      const j = JSON.parse(message);

      if (j?.task?.node?.id) {
        const nodeId = j.task.node.id;
        //console.log("nodeId", nodeId)
        if (!connections.get(nodeId)) {
          connections.set(nodeId, ws);
          ws.data["nodeId"] = nodeId;
          console.log("Websocket nodeId", nodeId)
        }
        if (!activeProcessors.has(nodeId) && !activeCoprocessors.has(nodeId)) {
          // Need to register again
          const task = {
            meta: {
              updatedAt: utils.updatedAt(),
            },
            hub: {command: "register"},
            node: {},
          };
          console.log("Request for registering " + nodeId)
          wsSendTask(task, nodeId);
          return;
        }
      }

      // Add the user id if it is not set
      if (!j?.task?.user?.id && userId) {
        j.task["user"] = {id: userId};
      }

      if (j?.task && j.task?.node?.command !== "ping") {
        let task = j.task;
        task = await taskProcess_async(task);

        // taskProcess_async has sent task to coprocessor
        if (task === null) {
          return;
        }

        if (task.node.command !== "partial") {
          const byteSize = Buffer.byteLength(message, 'utf8');
          utils.logTask(task, `Message size in bytes: ${byteSize} from ${task?.hub?.sourceProcessorId}`);
        }

        // If there are multiple coprocessors then we may need to specify a priority
        // We start the co-processing from taskSync.mjs

        const coprocessors = Array.from(activeCoprocessors.keys());
        const wasLastCoProcessor = task.hub?.coprocessingPosition === (coprocessors.length - 1);

        // Most of the coprocessing code could be moved into taskProcess_async ?
        let nodeId;
        if (task.hub.coprocessing && wasLastCoProcessor) {
          utils.logTask(task, "wasLastCoProcessor so stop coprocessing")
          task.hub.coprocessing = false;
          nodeId = task.hub.initiatingNodeId
          task.hub.sourceProcessorId = nodeId;
        } else {
          nodeId = task.hub.sourceProcessorId;
        }

        // Have not tested this yet because we only have one coprocessor
        // There is very similar code in taskSync.mjs
        if (task.node.isCoprocessor && task.hub.coprocessing && !wasLastCoProcessor) {
          utils.logTask(task, "Looking for NEXT coprocessor");
          // Send through the coprocessors
          // The task.hub.coprocessingPosition decides which coprocessor to run
          // It would be faster to chain the coprocessors directly as this avoids a request/response from the hub
          task.hub.coprocessingPosition++;
          // Should loop over the coprocessors to deal with case where command is not supported
          const coprocessorId = coprocessors[task.hub.coprocessingPosition];
          const coprocessorData = activeCoprocessors.get(coprocessorId);
          if (coprocessorData && coprocessorData.commandsAccepted.includes(task.hub.command)) {
            const ws = connections.get(coprocessorId);
            if (!ws) {
              utils.logTask(task, "Lost websocket for ", coprocessorId, connections.keys());
            } else {
              utils.logTask(task, "Websocket coprocessor chain", coprocessorId);
              // If the task is only on one coprocessor at a time then we could just use task.coprocessor ?
              if (!task.nodes[coprocessorId]) {
                task.nodes[coprocessorId] = {id: coprocessorId, isCoprocessor: true};
              }
              task.hub["coprocessing"] = true;
              task.hub["coprocessingDone"] = false;
              wsSendTask(task, coprocessorId);
            }
          }
        }

        if (!task.hub.coprocessing) {
          const activeTaskProcessors = await activeTaskProcessorsStore_async.get(task.instanceId);
          // Allows us to track where the request came from while coprocessors are in use
          nodeId = task.hub.initiatingNodeId || nodeId;
          task.node = task.nodes[nodeId];
          task.hub.sourceProcessorId = nodeId;
          task.hub["coprocessingPosition"] = null;
          if (wasLastCoProcessor) {
            if (task.hub.command !== "partial") {
              utils.logTask(task, "Finished with coprocessors id:", task.id, "nodeId:", nodeId);
              utils.logTask(task, "initiatingNodeId", task.hub["initiatingNodeId"]);
            }
            task.hub["coprocessingDone"] = true;
          }
          switch (task.hub.command) {
            case "init":
              commandInit_async(task);
              break;
            case "start":
              commandStart_async(task);
              break;
            case "update":
              commandUpdate_async(task);
              break;
            case "error":
              commandError_async(task);
              break;
            case "join":
              commandJoin_async(task);
              break;
            case "partial":
              for (const id of activeTaskProcessors) {
                if (id !== nodeId) {
                  const nodeData = activeProcessors.get(id);
                  if (nodeData && nodeData.commandsAccepted.includes(task.hub.command)) {
                    const ws = connections.get(id);
                    if (!ws) {
                      utils.logTask(task, "Lost websocket for ", id, connections.keys());
                    } else {
                      //utils.logTask(task, "Forwarding " + task.hub.command + " to " + id + " from " + nodeId)
                      wsSendTask(task, id);
                    }
                  }
                }
              }
              break;
            default:
              throw new Error("Unknown command " + task.hub.command);
          }
        }
      }

      if (j?.task?.node?.command === "ping") {
        const task = {
          meta: {
            updatedAt: utils.updatedAt(),
          },
          hub: {command: "pong"},
          node: {},
        };
        //utils.logTask(task, "Pong " + j.task.node.id)
        wsSendTask(task, j.task.node.id);
      }

    });

    ws.on("close", async function (code, reason) {
      const nodeId = ws.data.nodeId;
      console.log("ws nodeId " + nodeId + " is closed with code: " + code + " reason: ", reason);
      if (nodeId) {
        connections.delete(nodeId);
        activeProcessors.delete(nodeId);
        activeCoprocessors.delete(nodeId);
        const activeProcessorTasks = await activeProcessorTasksStore_async.get(nodeId);
        if (activeProcessorTasks) {
          // for each task delete entry from activeTaskProcessorsStore_async
          for (const taskId of activeProcessorTasks) {
            let activeTaskProcessors = await activeTaskProcessorsStore_async.get(taskId);
            if (activeTaskProcessors) {
              console.log("Removing node " + nodeId + " from task " + taskId);
              activeTaskProcessors = activeTaskProcessors.filter(id => id !== nodeId);
              if (activeTaskProcessors.length > 0) {
                await activeTaskProcessorsStore_async.set(taskId, activeTaskProcessors);
              } else {
                console.log("No node for task " + taskId);
                await activeTaskProcessorsStore_async.delete(taskId);                
              }
            }
          }
          await activeProcessorTasksStore_async.delete(nodeId);
        }
      }
    });

    // Assuming that close is called after error - need to check this assumption
    ws.on('error', function(error) {
      console.error("Websocket error: ", error);
    });

  });
}

export { initWebSocketServer, wsSendTask };
