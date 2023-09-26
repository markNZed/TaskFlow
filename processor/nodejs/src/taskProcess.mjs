/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Tasks/taskFunctions.mjs";
import { utils } from "./utils.mjs";
import { activeTaskFsm } from "./storage.mjs";
import { getFsmHolder_async } from "./shared/processor/fsm.mjs";
import { taskServices, taskServicesInitialized } from './taskServices.mjs';
import { CONFIG_DIR, ENVIRONMENTS } from "../config.mjs";

let serviceTypes = await utils.load_data_async(CONFIG_DIR, "servicetypes");
serviceTypes = utils.flattenObjects(serviceTypes);
//console.log(JSON.stringify(serviceTypes, null, 2))

function hasOverlap(arr1, arr2) {
  return arr1.some(item => arr2.includes(item));
}

export async function taskProcess_async(wsSendTask, task) {
  let updatedTask = {};
  if (taskFunctions && taskFunctions[(`${task.type}_async`)]) {
    try {
      task = utils.processorInTaskOut(task);
      utils.removeNullKeys(task);
      let fsmHolder = await getFsmHolder_async(task, activeTaskFsm.get(task.instanceId));
      utils.logTask(task, `Processing ${task.type} in state ${task?.state?.current}`);
      let services = {};
      const servicesConfig = task.config.services;
      if (servicesConfig) {
        // Dynamically import taskServices
        await taskServicesInitialized;
        Object.keys(servicesConfig).forEach((key) => {
          const environments = servicesConfig[key].environments;
          if (environments) {
            // Only try to load a service if it is expected to be on this processor
            if (hasOverlap(environments, ENVIRONMENTS)) {
              const type = servicesConfig[key].type;
              if (serviceTypes[type]) {
                services[key] = serviceTypes[type];
                services[key]["module"] = taskServices[serviceTypes[type]["moduleName"]];
              } else {
                throw new Error(`Servicetype ${type} not found in ${key} service of ${task.id} config: ${JSON.stringify(servicesConfig)}`);
              }
            }
          } else {
            throw new Error(`Servicetype ${key} service of ${task.id} has no environments`);
          }
        });
      }  
      const T = utils.createTaskValueGetter(task);
      updatedTask = await taskFunctions[`${task.type}_async`](wsSendTask, T, fsmHolder, services);
      if (fsmHolder.fsm) {
        console.log("Updating activeTaskFsm");
        activeTaskFsm.set(task.instanceId, fsmHolder.fsm);
      } else {
        console.log("No activeTaskFsm");
      }
      utils.logTask(task, `Finished ${task.type} in state ${task?.state?.current}`);
    } catch (e) {
      console.error(e);
      updatedTask = task;
      // Strictly we should not be updating the task object in the processor
      // Could set updatedTask.processor.command = "error" ?
      updatedTask.error = {message: e.message};
      updatedTask.command = "update";
      updatedTask.commandArgs = {lockBypass: true};
      if (updatedTask.type === "TaskShowInstruction") {
        throw e; // To avoid cycles
      }
    }
    // Returning null is  away of doing nothing
    if (updatedTask !== null) {
      if (updatedTask.error) {
        console.error("Task error ", updatedTask.error)
        updatedTask["command"] = "update";
        updatedTask["commandArgs"] = {lockBypass: true};
      }
      if (updatedTask?.command === "start") {
        // This is not working/used yet
        throw new Error("start not implemented yet");
        /*
        const task = {
          user: {id: updatedtask.user.id},
          startId: updatedTask.commandArgs.id,
          hub: {},
          command: "start",
        }
        wsSendTask(task);
        */
      } else if (updatedTask?.command === "update") {
        if (updatedTask?.commandArgs?.sync) {
          const command = updatedTask.command;
          const commandArgs = updatedTask.commandArgs;
          updatedTask = {};
          updatedTask["command"] = command;
          updatedTask["commandArgs"] = commandArgs;
          let instanceId = commandArgs.syncTask.instanceId || task.instanceId;
          updatedTask["instanceId"] = instanceId;
          updatedTask["meta"] = {};
          updatedTask["processor"] = {};
        }
        console.log("taskProcess_async sending");
        try {
          wsSendTask(updatedTask);
        } catch (error) {
          console.error(`Command ${updatedTask.command} failed to fetch ${error}`);
        }
      }
    } else {
      console.log("taskProcess_async null " + task.id);
    }
  } else {
    console.log("NodeJS Processor unknown component " + task.type);
    //console.log("taskFunctions", taskFunctions);
    updatedTask = task;
  }
}