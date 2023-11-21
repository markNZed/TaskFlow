/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { WSConnections, activeTaskNodesStore_async, activeNodeTasksStore_async, activeNodes, reloadOneConfig_async, usersStore_async, tribesStore_async, groupsStore_async } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { commandUpdate_async } from "./commandUpdate.mjs";
import { commandStart_async } from "./commandStart.mjs";
import { commandInit_async } from "./commandInit.mjs";
import { commandError_async } from "./commandError.mjs";
import { commandReload_async } from "./commandReload.mjs";
import { taskProcess_async } from "./taskProcess.mjs";
import { commandJoin_async } from "./commandJoin.mjs";
import { commandRegister_async, registerTask_async } from "./commandRegister.mjs";
import { JWT_SECRET, MAP_USER, NODETribe } from "../config.mjs";
import jwt from 'jsonwebtoken';

/**
 * Sends an object through the WebSocket connection identified by the given node ID.
 *
 * @param {string} nodeId - The ID of the WebSocket connection to use.
 * @param {Object} [message={}] - The object to send through the connection.
 * @throws {Error} If the message object does not have a task property.
 */
function wsSendObject(nodeId, message = {}) {
  const ws = WSConnections.get(nodeId);
  if (!ws) {
    console.error(`Lost websocket for wsSendObject with nodeId ${nodeId} and message task ${utils.js(message.task)}`);
  } else {
    ws.send(JSON.stringify(message));
    if (message.task.node.command !== "pong") {
      //console.log("wsSendObject message.task.output.sending", message.task?.output?.sending);
      //console.log("wsSendObject ", nodeId, message.task.node )
    }
  }
}

async function maskOutgoing_async(task) {
  // We trust the task.masks
  if (task.node.type !== "hub" && task.masks) {
    let mask = utils.deepClone(task.masks.outgoing) || {};
    //utils.logTask(task, "maskOutgoing_async mask before env", task.node.id, mask);
    const nodeEnv = task.node.environment;
    if (task.masks[nodeEnv] && task.masks[nodeEnv].outgoing) {
      mask = utils.deepMerge(mask, task.masks[nodeEnv].outgoing);
      //utils.logTask(task, "maskOutgoing_async mask after env", task.node.id, nodeEnv, mask);
    }
    const groupId = task.groupId;
    if (groupId) {
      let group = await groupsStore_async.get(groupId);
      if (group?.unmask?.outgoing) {
        utils.deleteKeysBasedOnMask(mask, group.unmask.outgoing);
        //utils.logTask(task, "maskOutgoing_async unmask group", task.node.id, groupId, mask);
      }
    }
    const devGroupId = "dev";
    if (task.user?.groups && task.user?.groups.includes(devGroupId)) {
      let group = await groupsStore_async.get(devGroupId);
      if (group?.unmask?.outgoing) {
        utils.deleteKeysBasedOnMask(mask, group.unmask.outgoing);
        //utils.logTask(task, "maskOutgoing_async unmask dev", task.node.id, devGroupId, group, mask);
      }
    }
    //utils.logTask(task, "maskOutgoing_async after unmask", task.node.id, mask);
    if (Object.keys(mask).length > 0) {
      utils.deleteKeysBasedOnMask(task, mask);
    }
  }
  //utils.logTask(task, "maskOutgoing_async keys", task.node.id, task.node.type, task.masks, Object.keys(task), );
  return task;
}

const wsSendTask = async function (taskIn, nodeId, activeTask) {
  utils.debugTask(taskIn, "input");
  // If we are sending to a Hub node then don't bother sending diff ?
  const currentNode = utils.deepClone(taskIn.node);
  if (!currentNode?.command) {
    throw new Error("Missing command in wsSendTask" + JSON.stringify(taskIn));
  }
  //console.log("wsSendTask task.request", task.request)
  let task = utils.deepClone(taskIn); //deep copy because we make changes e.g. task.node
  // nodeDiff will remove nodes and users
  let outgoingNode;
  if (task.nodes && task.nodes[nodeId] && Object.keys(task.nodes[nodeId]).length > 0) {
    outgoingNode = utils.deepClone(task.nodes[nodeId]);
  }
  let masks;
  if (activeTask?.masks) {
    masks = utils.deepClone(activeTask.masks);
  }
  let user;
  if (task.user && task.users && task.user.id && task.users[task.user.id]) {
    user = utils.deepClone(task.users[task.user.id]);
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
        diff = utils.nodeDiff(activeTask, task);
      }
      if (Object.keys(diff).length === 0) {
        utils.logTask(task, "wsSendTask no diff", diff);
        return null;
      }
      task = diff;
    } else {
      console.error("Update but no active task for " + task.id);
      return;
    }
  }
  //utils.logTask(task, "wsSendTask " + command + " message state", message["task"].state);
  // For example task.command === "partial" does not have task.nodes
  //utils.logTask(task, "wsSendTask currentNode", currentNode);
  if (outgoingNode) {
    utils.logTask(task, "wsSendTask outgoingNode", nodeId);
    //deep copy because we are going to edit the object
    task["node"] = outgoingNode;
    delete task.nodes;
  } else {
    // When sending the register command we do not have a nodeId
    //utils.logTask(task, "wsSendTask no outgoingNode", nodeId);
    task["node"] = activeNodes.get(nodeId) || currentNode;
  }
  task.node["command"] = currentNode.command;
  task.node["commandArgs"] = currentNode.commandArgs;
  task.node["commandDescription"] = currentNode.commandDescription;
  const { coprocessing, coprocessed, initiatingNodeId, sourceNodeId } = currentNode;
  if (task.node.role === "coprocessor") {
    task.node["coprocessing"] = coprocessing;
    task.node["coprocessed"] = coprocessed;
  }
  task.node["initiatingNodeId"] = initiatingNodeId;
  task.node["sourceNodeId"] = sourceNodeId;
  if (user) {
    if (!task?.user?.id) {
      utils.logTask(task, "wsSendTask no user", task);
    }
    task["user"] = user;
    //delete task.users;
  }
  task.meta = task.meta || {};
  if (currentNode.command !== "pong" && currentNode.command !== "partial") {
    //utils.logTask(task, "wsSendTask sourceNodeId " + currentNode.sourceNodeId)
    utils.logTask(task, "wsSendTask task " + (task.id || task.instanceId) + " to " + nodeId)
    //utils.logTask(task, "wsSendTask currentNode.commandArgs.sync", currentNode?.commandArgs?.sync);
  }
  // Need to restore task.masks for maskOutgoing_async
  task.masks = masks;
  // The less we leave in the less chance of unimportant conflicts
  delete task.command;
  delete task.commandArgs;
  delete task.commandDescription;
  message["task"] = await maskOutgoing_async(task);
  //utils.logTask(task, "wsSendTask user", task.user);
  utils.debugTask(task, "output");
  wsSendObject(nodeId, message);
}

function initWebSocketServer(server) {

  const websocketServer = new WebSocketServer({ server: server, path: "/hub/ws" });

  // eslint-disable-next-line no-unused-vars
  websocketServer.on("connection", (ws, req) => {
    
    console.log("websocketServer connection");

    ws.data = { nodeId: undefined };

    const sourceIP = utils.getSourceIP(req);
    const origin = req.headers.origin;
    let hostname;
    if (origin) {
      try {
        const url = new URL(origin);
        hostname = url.hostname;
        console.log(`Websocket connecting to ${hostname} from ${sourceIP}`);
      } catch (e) {
        console.log("Websocket connecting invalid origin", origin, sourceIP);
        return;
      }
    } else {
      console.log("Websocket connecting no origin", origin, sourceIP);
      return;
    }

    ws.on("message", async (message) => {

      try {

        const j = JSON.parse(message);

        let task = j?.task;
        let userId;

        if (!task) {
          console.log("No task", message);
          return;
        }

        let incomingNode = task?.node;

        if (task?.tokens?.authToken) {
          let decoded;
          try {
            decoded = jwt.verify(task?.tokens?.authToken, JWT_SECRET);
            //throw Error("testing");
          } catch (err) {
            // We could have a logout command
            console.log("authToken invalid sending login command", err);
            const taskLogin = {
              meta: {
                updatedAt: utils.updatedAt(),
              },
              node: {command: "login"},
            };
            const nodeId = incomingNode.id;
            WSConnections.set(nodeId, ws);
            wsSendTask(taskLogin, nodeId);
            return;
          }
          //console.log("authToken found", decoded);
          userId = decoded.username.toLowerCase();
          if (MAP_USER && MAP_USER[userId]) {
            userId = MAP_USER[userId];
          } else if (task?.user?.id && task.user.id !== userId) {
            console.log("task.user.id does not match JWT token", task.user.id, userId);
            return;
          }
          const user = await usersStore_async.get(userId);
          // Check that the user still exists
          if (!user) {
            console.log("User not found", userId);
            return;
          }
          // Could also have an option to refresh the JWT based on e.g. data
          let  tribeName = decoded.hostname;
          //utils.logTask(task, "Incoming tribe", userId, tribeName);
          // If the hostname is taskflow then we assume an internal connection
          if (hostname !== "taskflow") {
            if (user.tribes.includes("god")) {
              tribeName = hostname;
              //utils.logTask(task,"God dropping into tribe", userId, tribeName);
            } else if (tribeName && hostname !== tribeName) {
              console.log("Wrong hostname", hostname, tribeName);
              return;
            } else if (!tribeName) {
              utils.logTask(task, "No tribe found so default to world");
              tribeName = "world";
            }
            const tribe = await tribesStore_async.get(tribeName);
            if (!tribe) {
              utils.logTask(task, "No tribe found", userId, tribeName);
              return;
            }
            if (user.tribes && !user.tribes.includes(tribeName) && !user.tribes.includes("god")) {
              utils.logTask(task, "User not in tribe", userId, tribeName);
              return;
            }
            // Allocate user to tribe
            task["user"] = user;
            task.user["tribe"] = tribeName;
            //utils.logTask(task, "Set user tribe", userId, tribeName);
            NODETribe(tribe);
            utils.debugTask(task, "set tribe");
          }
        } else if (hostname !== "taskflow") {
          console.log("No authToken");
          return;
        }

        if (incomingNode?.id) {
          const nodeId = incomingNode.id;
          //console.log("nodeId", nodeId)
          if (!WSConnections.get(nodeId)) {
            WSConnections.set(nodeId, ws);
            ws.data["nodeId"] = nodeId;
            console.log("Websocket nodeId", nodeId)
          }
          if (!activeNodes.has(nodeId) && incomingNode?.command !== "register") {
            registerTask_async(wsSendTask, nodeId);
            return;
          }
        }
        if (incomingNode?.command === "configLoad") {
          // This is a hack because we have not yet merged hub and rxjs
          // Should be replaced with a service but for now rxjs does not 
          // have access to the configdata so only hub can reload
          await reloadOneConfig_async("tasktypes");
          await reloadOneConfig_async("tasks"); // side effect of initializing autoStartTasksStore_async
          await reloadOneConfig_async("users"); // side effect of initializing groupsStore_async
          await reloadOneConfig_async("tribes");
        } else if (incomingNode?.command === "reload") {
          // We don't rounte this through the coprocessor 
          task.node.coprocessed = false;
          try {
            task = await taskProcess_async(task);
          } catch {
            console.error("taskProcess_async error", task);
            return;
          }
          commandReload_async(task);
        } else if (incomingNode?.command === "ping") {
          const taskPong = {
            meta: {
              updatedAt: utils.updatedAt(),
            },
            node: {command: "pong"},
          };
          //utils.logTask(taskPong, "Pong " + incomingNode.id);
          wsSendTask(taskPong, incomingNode.id);
        } else if (incomingNode?.command === "partial") {
          try {
            task = await taskProcess_async(task);
          } catch {
            console.error("taskProcess_async error", task);
            return;
          }
          const activeTaskNodes = await activeTaskNodesStore_async.get(task.instanceId);
          let initiatingNodeId = task.node.initiatingNodeId
          if (activeTaskNodes) {
            for (const nodeId of activeTaskNodes) {
              if (nodeId !== initiatingNodeId) {
                const nodeData = activeNodes.get(nodeId);
                if (nodeData && nodeData.commandsAccepted.includes(task.node.command)) {
                  const ws = WSConnections.get(nodeId);
                  if (!ws) {
                    utils.logTask(task, "Lost websocket for ", nodeId, WSConnections.keys());
                  } else {
                    //utils.logTask(task, "Forwarding " + task.node.command + " to " + nodeId + " from " + nodeId)
                    wsSendObject(nodeId, {task: task});
                  }
                }
              }
            }
          }
        } else if (task) {
          // Add the user id if it is not set
          if (!task?.user?.id && userId) {
            task["user"] = task.user || {}; // user.tribe may be set
            task.user["id"] = userId;
          }
          
          const processedTask = await taskProcess_async(task);

          // taskProcess_async has sent task to coprocessor
          if (processedTask === null) {
            utils.logTask(task, `Null back from taskProcess_async`);
            return;
          } else {
            task = processedTask;
          }

          const byteSize = Buffer.byteLength(message, 'utf8');
          utils.logTask(task, `Message size in bytes: ${byteSize} from ${task.node?.sourceNodeId}`);

          let initiatingNodeId = task.node.initiatingNodeId;

          // We start the co-processing from taskSync.mjs so here has passed through coprocessing
          task.node["coprocessing"] = false;
          task.node["coprocessed"] = true;
          task.node.sourceNodeId = initiatingNodeId;

          // Allows us to track where the request came from while coprocessors are in use
          task.node.sourceNodeId = initiatingNodeId;

          utils.logTask(task, "initiatingNodeId", initiatingNodeId);

          switch (task.node.command) {
            case "init":
              commandInit_async(task)
                .catch((error) => {
                  console.error("ws commandInit_async error", error);
                });
              break;
            case "start":
              commandStart_async(task)
              .catch((error) => {
                console.error("ws commandStart_async error", error);
              });
            break;
            case "update":
              commandUpdate_async(task)
              .catch((error) => {
                console.error("ws commandUpdate_async error", error);
              });
            break;
            case "error":
              commandError_async(task)
              .catch((error) => {
                console.error("ws commandError_async error", error);
              });
            break;
            case "join":
              commandJoin_async(task)
              .catch((error) => {
                console.error("ws commandJoin_async error", error);
              });
            break;
            case "register":
              commandRegister_async(task)
              .catch((error) => {
                console.error("ws commandRegister_async error", error);
              });
            break;
            default:
              throw new Error("Unknown command " + task.node.command);
          }
        } else {
          console.error("ws unknown message", message);
          throw new Error("Unknown message");
        }

      } catch (error) {
        console.error("ws error", error);
      }

    });

    ws.on("close", async function (code, reason) {
      const nodeId = ws.data.nodeId;
      console.log("ws nodeId " + nodeId + " is closed with code: " + code + " reason: ", reason);
      if (nodeId) {
        WSConnections.delete(nodeId);
        activeNodes.delete(nodeId);
        const activeNodeTasks = await activeNodeTasksStore_async.get(nodeId);
        if (activeNodeTasks) {
          // for each task delete entry from activeTaskNodesStore_async
          for (const taskId of activeNodeTasks) {
            let activeTaskNodes = await activeTaskNodesStore_async.get(taskId);
            if (activeTaskNodes) {
              console.log("Removing node " + nodeId + " from task " + taskId);
              activeTaskNodes = activeTaskNodes.filter(id => id !== nodeId);
              if (activeTaskNodes.length > 0) {
                await activeTaskNodesStore_async.set(taskId, activeTaskNodes);
              } else {
                console.log("No node for task " + taskId);
                await activeTaskNodesStore_async.delete(taskId);                
              }
            }
          }
          await activeNodeTasksStore_async.delete(nodeId);
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
