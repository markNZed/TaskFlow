/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { activeProcessors, activeCoprocessors, autoStartTasksStore_async } from "../storage.mjs";
import { hubId, haveCoprocessor } from "../../config.mjs";
import { commandStart_async } from "../commandStart.mjs";
import { utils } from "../utils.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// We need to authenticate the processorId
// Could just be a shared secret in the body
router.post("/", async (req, res) => {
  console.log("/hub/api/register");
  let processorId = req.body.processorId;
  let environment = req.body.environment;
  let commandsAccepted = req.body?.commandsAccepted;
  let serviceTypes = req.body?.serviceTypes;
  let language = req.body?.language;
  let coprocessor = req.body?.coprocessor;

  let userId = utils.getUserId(req);

  if (commandsAccepted === undefined) {
    commandsAccepted = ["partial", "update", "init", "join", "pong", "register", "error"];
  }
  if (language === undefined) {
    language = "EN";
  }
  if (coprocessor === undefined) {
    coprocessor = false;
  }

  if (typeof environment !== "string") {
    throw new Error("environment must be a string");
  }

  console.log("processorId " + processorId + " registered with commandsAccepted " + JSON.stringify(commandsAccepted));
  //console.log("processorId " + processorId + " registered with serviceTypes " + JSON.stringify(serviceTypes));
  console.log("processorId " + processorId + " registered with environment " + JSON.stringify(environment) + " language " + language + " coprocessor " + coprocessor);
    
  if (coprocessor) {
    activeCoprocessors.set(processorId, {
      environment,
      commandsAccepted,
      serviceTypes,
      language,
      isCoprocessor: true,
    })
  } else {  
    activeProcessors.set(processorId, {
      environment,
      commandsAccepted,
      serviceTypes,
      language,
    })
  }

  res.send({
    hubId: hubId,
  });

  // After each processor registers then we can check if there are tasks to autostart
  // Check if there are autoStartTasks 
  let countAutoStartTasks = 0;
  let activeEnvironments = [];
  activeProcessors.forEach(item => {
    activeEnvironments.push(item.environment);
  });
  activeCoprocessors.forEach(item => {
    activeEnvironments.push(item.environment);
  });
  activeEnvironments = [...new Set(activeEnvironments)]; // uniquify

  // Do not autostart task until after the coprocessor has started
  // probably need to wait for all coprocessors first but we don't have the list
  // Probably need to convert haveCoprocessor into Coprocessors (maybe capitals and set from ENV)
  if (haveCoprocessor && activeCoprocessors.size === 0) {
    console.log("haveCoprocessor && activeCoprocessors.size === 0");
    return
  }

  for await (const [taskId, autoStartTask] of autoStartTasksStore_async.iterator()) {
    countAutoStartTasks++;
    console.log(`Checking autostart ${environment} for task`, taskId, autoStartTask);
    const autoStartEnvironment = autoStartTask.startEnvironment;
    let startEnvironments = autoStartTask.startEnvironments || [];
    if (activeEnvironments.includes(autoStartEnvironment)) {
      //console.log("startEnvironments", startEnvironments);
      let allEnvironmentsAvailable = true;
      // get the environment for this task
      startEnvironments.forEach(startEnvironment => {
        // Is each startEnvironment available in environment ?
        if (!activeEnvironments.includes(startEnvironment)) {
          //console.log("startEnvironment " + startEnvironment + " not available", environment);
          allEnvironmentsAvailable = false;
        }
      })
      // If we have already started the task then we should only restart it if the particular
      // processor rgisteirng now is the autoStartEnvironment
      // This was added because if the coprocessor has not started then we will not autostart
      // Then when the coprocessor starts allEnvironmentsAvailable will be true
      // We want to start the task once in that case not every time any processor is registered.
      if (autoStartTask.started) {
        if (autoStartEnvironment !== environment) {
          allEnvironmentsAvailable = false;
        }
      }
      if (allEnvironmentsAvailable) {
        //console.log("allEnvironmentsAvailable");
        const initTask = {
          id: taskId,
          user: {id: userId},
          autoStart: true,
        }
        let task = {id: "autoStart"};
        task["hub"] = {};
        task.hub["commandArgs"] = {
          init: initTask,
          authenticate: false, // Do we need this because request is not coming from internet but local processor, would be better to detect this in the authentication?
        }
        task.hub["command"] = "start";
        task.hub["sourceProcessorId"] = "hub";
        task["processor"] = {};
        task["processor"]["id"] = processorId;
        console.log("Autostarting task ", taskId, environment);
        commandStart_async(task);
        if (autoStartTask.once) {
          await autoStartTasksStore_async.delete(taskId);
        } else {
          autoStartTask["started"] = true;
          await autoStartTasksStore_async.set(taskId, autoStartTask);
        }
      } else {
        //console.log("Not autostarting task allEnvironmentsAvailable false");
      }
    } else {
      //console.log("Not autostarting task autoStartEnvironment", autoStartEnvironment, "not in", activeEnvironments);
    }
  }
  console.log(countAutoStartTasks + " autostart tasks");
});

// Export the router
export default router;
