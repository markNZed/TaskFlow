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
  let environments = req.body.environments;
  let commandsAccepted = req.body?.commandsAccepted;
  let messagesStyle = req.body?.messagesStyle;
  let serviceTypes = req.body?.serviceTypes;
  let language = req.body?.language;
  let coprocessor = req.body?.coprocessor;

  let userId = utils.getUserId(req);

  if (commandsAccepted === undefined) {
    commandsAccepted = ["partial", "update", "init", "join", "pong", "register", "error"];
  }
  // Not used yet but could e usful for interfacing with a third party service
  if (messagesStyle === undefined) {
    messagesStyle = {
      wsOutputDiff: false,
      wsInputDiff: true,
      httpOutputDiff: false,
      httpInputDiff: false, // Not used by Hub yet
    };
  }
  if (language === undefined) {
    language = "EN";
  }
  if (coprocessor === undefined) {
    coprocessor = false;
  }

  console.log("processorId " + processorId + " registered with commandsAccepted " + JSON.stringify(commandsAccepted));
  //console.log("processorId " + processorId + " registered with serviceTypes " + JSON.stringify(serviceTypes));
  //console.log("processorId " + processorId + " registered with messagesStyle " + JSON.stringify(messagesStyle));
  console.log("processorId " + processorId + " registered with environments " + JSON.stringify(environments) + " language " + language + " coprocessor " + coprocessor);
    
  if (coprocessor) {
    activeCoprocessors.set(processorId, {
      environments,
      commandsAccepted,
      serviceTypes,
      messagesStyle,
      language,
      isCoprocessor: true,
    })
  } else {  
    activeProcessors.set(processorId, {
      environments,
      commandsAccepted,
      serviceTypes,
      messagesStyle,
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
    activeEnvironments.push(...item.environments);
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
    console.log("Checking autostart for task", taskId);
    const autoStartEnvironment = autoStartTask.startEnvironment;
    let startEnvironments = autoStartTask.startEnvironments;
    if (environments.includes(autoStartEnvironment)) {
      //console.log("environments.includes(autoStartEnvironment)");
      let allEnvironmentsAvailable = true;
      // get the environments for this task
      // Is each startEnvironment avialable in environments ?
      startEnvironments.forEach(startEnvironment => {
        if (!environments.includes(startEnvironment)) {
          //console.log("startEnvironment " + startEnvironment + " not available", environments);
          allEnvironmentsAvailable = false;
        }
      })
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
        //console.log("Autostarting task ", task);
        commandStart_async(task);
        if (autoStartTask.once) {
          await autoStartTasksStore_async.delete(taskId);
        }
      } else {
        //console.log("Not autostarting task allEnvironmentsAvailable false");
      }
    } else {
      // console.log("Not autostarting task environments",environments, "does not include " + autoStartEnvironment);
    }
  }
  console.log(countAutoStartTasks + " autostart tasks");
});

// Export the router
export default router;
