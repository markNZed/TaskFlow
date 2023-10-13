/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { activeNodes, autoStartTasksStore_async } from "../storage.mjs";
import { NODE } from "../../config.mjs";
import { commandStart_async } from "../commandStart.mjs";
import { utils } from "../utils.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { taskLock, taskRelease } from '#shared/taskLock';

const router = express.Router();

// We need to authenticate the nodeId
// Could just be a shared secret in the body
router.post("/", async (req, res) => {
  console.log("/hub/api/register");
  let nodeId = req.body.nodeId;
  let environment = req.body.environment;
  let commandsAccepted = req.body?.commandsAccepted;
  let language = req.body?.language;
  let type = req.body?.type;
  let role = req.body?.role;
  let processing = req.body?.processing;

  let userId = utils.getUserId(req);

  if (commandsAccepted === undefined) {
    commandsAccepted = ["partial", "update", "init", "join", "pong", "register", "error"];
  }
  if (language === undefined) {
    language = "EN";
  }

  if (typeof environment !== "string") {
    throw new Error("environment must be a string");
  }

  console.log("nodeId " + nodeId + " registered with commandsAccepted " + JSON.stringify(commandsAccepted) + " environment " + JSON.stringify(environment) + " language " + language);
    
  if (role === "coprocessor") {
    NODE["haveCoprocessor"] = true;
  }

  activeNodes.set(nodeId, {
    environment,
    commandsAccepted,
    language,
    type,
    role,
    processing,
  })

  res.send({
    hubId: NODE.id,
  });

  // After each node registers then we can check if there are tasks to autostart
  // Check if there are autoStartTasks 
  let countAutoStartTasks = 0;
  let activeEnvironments = [];
  activeNodes.forEach(item => {
    activeEnvironments.push(item.environment);
  });
  activeEnvironments = [...new Set(activeEnvironments)]; // uniquify

  // Do not autostart task until the hubNodeEnvironments have started
  // Otherwise a task could start on one Hub node and not another leading to hash mismatches
  let allHubEnvironmentsAvailable = NODE["hubNodeEnvironments"].every(
    env => activeEnvironments.includes(env)
  );
  if (!allHubEnvironmentsAvailable) {
    return;
  }

  const autoStartTasksArray = [];
  for await (const [taskId, autoStartTask] of autoStartTasksStore_async.iterator()) {
    autoStartTasksArray.push([taskId, autoStartTask]);
  }
  // Sort the autoStartTasksArray by .autoStartpriority property
  const sortedAutoStartTasksArray = autoStartTasksArray.sort((a, b) => {
    const autoStartTaskA = a[1];
    const autoStartTaskB = b[1];
    // Place tasks with undefined autoStartpriority at the end
    if (autoStartTaskA.autoStartpriority === undefined) return -1;
    if (autoStartTaskB.autoStartpriority === undefined) return 1;
    // Alphanumeric Compare using localeCompare
    return autoStartTaskB.autoStartpriority.localeCompare(autoStartTaskA.autoStartpriority, undefined, {numeric: true});
  });
  //console.log("sortedAutoStartTasksArray", sortedAutoStartTasksArray);
  // eslint-disable-next-line no-unused-vars
  for (let [taskId, autoStartTask] of sortedAutoStartTasksArray) {
    const autoStartEnvironment = autoStartTask.startEnvironment;
    if (autoStartTask.started && autoStartEnvironment !== environment) {
      continue;
    }
    // Lock the task when autostarting to ensure one task is started
    taskLock(taskId, "autostart");
    // Load the task after getting the lock so we can see any updates
    autoStartTask = await autoStartTasksStore_async.get(taskId)
    countAutoStartTasks++;
    console.log(`Checking autostart ${environment} for task`, taskId, "started", autoStartTask.started);
    let startEnvironments = autoStartTask.startEnvironments || [];
    if (activeEnvironments.includes(autoStartEnvironment)) {
      //console.log("startEnvironments", startEnvironments);
      // get the environment for this task
      let allEnvironmentsAvailable = startEnvironments.every(
        env => activeEnvironments.includes(env)
      );
      if (!allEnvironmentsAvailable) {
        console.log(`Checking autostart !allEnvironmentsAvailable`);
        continue;
      }
      // If we have already started the task then we should only restart it if the particular
      // node registering now is the autoStartEnvironment
      // This was added because if the coprocessor has not started then we will not autostart
      // Then when the coprocessor starts allEnvironmentsAvailable will be true
      // We want to start the task once in that case not every time any node is registered.
      if (autoStartTask.started && autoStartEnvironment !== environment) {
        console.log(`Checking autostart autoStartTask.started && autoStartEnvironment !== environment`);
        continue;
      }
      //console.log("allEnvironmentsAvailable");
      const initTask = {
        id: taskId,
        user: {id: userId},
      }
      let task = {id: "autoStart"};
      task["instanceId"] = NODE.id;
      task["node"] = {};
      task.node["commandArgs"] = {
        init: initTask,
        authenticate: false, // Do we need this because request is not coming from internet but local node, would be better to detect this in the authentication?
      }
      task.node["command"] = "start";
      task.node["commandDescription"] = "Autostarting task";
      task.node["sourceNodeId"] = NODE.id;
      task.node["initiatingNodeId"] = nodeId; // So the task will start on the node that is registering 
      task["nodes"] = {};
      task.nodes[nodeId] = activeNodes.get(nodeId);
      console.log("Autostarting task ", taskId, environment);
      utils.debugTask(task);
      commandStart_async(task);
      if (autoStartTask.once) {
        await autoStartTasksStore_async.delete(taskId);
      } else {
        let newAutoStartTask = autoStartTask;
        newAutoStartTask["started"] = true;
        await autoStartTasksStore_async.set(taskId, newAutoStartTask);
      }
    } else {
      //console.log("Not autostarting task autoStartEnvironment", autoStartEnvironment, "not in", activeEnvironments);
    }
    taskRelease(taskId);
  }
  console.log(countAutoStartTasks + " autostart tasks");

});

// Export the router
export default router;
