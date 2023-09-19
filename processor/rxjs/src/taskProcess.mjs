/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./taskFunctions.mjs";
import { CEPFunctions } from "./CEPFunctions.mjs";
import { utils } from "./utils.mjs";
import { processorId, COPROCESSOR, CONFIG_DIR, ENVIRONMENTS } from "../config.mjs";
import { activeTaskFsm } from "./storage.mjs";
import { getFsmHolder_async } from "./shared/processor/fsm.mjs";
import { taskServices, taskServicesInitialized } from './taskServices.mjs';

let serviceTypes = await utils.load_data_async(CONFIG_DIR, "servicetypes");
serviceTypes = utils.flattenObjects(serviceTypes);
//console.log(JSON.stringify(serviceTypes, null, 2))

function hasOverlap(arr1, arr2) {
  return arr1.some(item => arr2.includes(item));
}

export async function taskProcess_async(wsSendTask, task, CEPFuncs) {
  let updatedTask = null;
  try {
    utils.logTask(task, "taskProcess_async", task.id);
    utils.logTask(task, "taskProcess_async task.processor.coprocessing", task.processor.coprocessing);
    const processorMatch = task.processor.initiatingProcessorId === processorId;
    if (processorMatch) {
      utils.logTask(task, "RxJS Task Processor from this processor so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (task.processor["command"] === "error") {
      utils.logTask(task, "RxJS Task Processor error so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (task.processor["command"] === "start") {
      utils.logTask(task, "RxJS Task Processor start so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (COPROCESSOR && task.processor?.commandArgs?.sync) {
      // Seems a risk of CEP operating on sync creating loops
      // Could have a rule that sync do not operate on the same task
      // True that in this case we can just modify the task
      utils.logTask(task, "RxJS Task Coprocessor sync so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (taskFunctions && taskFunctions[`${task.type}_async`]) {
      let fsmHolder = await getFsmHolder_async(task, activeTaskFsm.get(task.instanceId));
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
      // Option to run in background
      if (T("config.background")) {
        utils.logTask(task, `Processing ${task.type} in background`);
        taskFunctions[`${task.type}_async`](wsSendTask, T, fsmHolder, CEPFuncs, services);
      } else {
        utils.logTask(task, `Processing ${task.type} in state ${task?.state?.current}`);
        updatedTask = await taskFunctions[`${task.type}_async`](wsSendTask, T, fsmHolder, CEPFuncs, services);
      }
      utils.logTask(task, `Finished ${task.type} in state ${updatedTask?.state?.current}`);
    } else {
      utils.logTask(task, "RxJS Task Processor no Task Function for " + task.type);
    }
    // Create the CEP during the init of the task in the coprocessing step if a coprocessor
    if (task.processor["command"] === "init") {
      if (!COPROCESSOR || (COPROCESSOR && !task.processor.coprocessingDone)) {
        // How about overriding a match. createCEP needs more review/testing
        // Create two functions
        if (task.config?.ceps) {
          for (const key in task.config.ceps) {
            if (task.config.ceps[key]) {
              utils.createCEP(CEPFuncs, CEPFunctions, task, key, task.config.ceps[key]);
            }
          }
        }
      }
      //utils.logTask(task, "taskProcess_async CEPFuncs", CEPFuncs);
    }
  } catch (e) {
    console.error(e);
    updatedTask = task;
    // Strictly we should not be updating the task object in the processor
    // Could set updatedTask.processor.command = "error" ?
    updatedTask.error = {message: e.message};
    updatedTask.command = "update";
    updatedTask.commandArgs = {lockBypass: true};
  }
  if (updatedTask?.error) {
    console.error("Task error: ", updatedTask.error)
  }
  try {
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
    if (COPROCESSOR) {
      if (updatedTask === null) {
        updatedTask = task;
        utils.logTask(updatedTask, "taskProcess_async null so task replaces updatedTask", updatedTask.id);
        // The updatedTask.processor will take effect in wsSendTask
        // We are not working at the Task scope here so OK to reuse this 
      } else if (updatedTask.command) {
        // This processor wants to make a change
        // The original processor will no longer see the change as coming from it
        utils.logTask(updatedTask, "taskProcess_async initiatingProcessorId updated");
        updatedTask.processor["initiatingProcessorId"] = processorId;
      }
      if (!updatedTask.command) {
        // Because wsSendTask is expecting task.command
        updatedTask.command = task.processor.command;
        updatedTask.commandArgs = task.processor.commandArgs;
      }
      wsSendTask(updatedTask);
    } else {
      // This needs more testing
      // When not a coprocessor what do we want to do?
      // Which command should we support here?
      // This is similar to the old do_task
      if (updatedTask?.command === "update") {
        utils.logTask(updatedTask, "taskProcess_async sending update");
        wsSendTask(updatedTask);
      } else {
        utils.logTask(updatedTask, "taskProcess_async nothing to do");
      }
    }
  } catch (error) {
    utils.logTask(updatedTask, "taskProcess_async updatedTask", updatedTask);
    console.error(`Command ${updatedTask.command} failed to send ${error}`);
  }
  //wsSendTask(updatedTask);
  return updatedTask;
}
