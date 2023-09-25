/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { importTaskFunction_async, taskFunctionExists_async } from "./taskFunctions.mjs";
import { importService_async, serviceExists_async } from "./services.mjs";
import { importOperator_async, operatorExists_async } from "./operators.mjs";
import { CEPFunctions } from "./CEPFunctions.mjs";
import { utils } from "./utils.mjs";
import { NODE } from "../config.mjs";
import { activeTaskFsm } from "./storage.mjs";
import { getFsmHolder_async } from "./shared/processor/fsm.mjs";

let serviceTypes = await utils.load_data_async(NODE.configDir, "servicetypes");
serviceTypes = utils.flattenObjects(serviceTypes);
//console.log(JSON.stringify(serviceTypes, null, 2))

let operatorTypes = await utils.load_data_async(NODE.configDir, "operatortypes");
operatorTypes = utils.flattenObjects(operatorTypes);
//console.log(JSON.stringify(operatorTypes, null, 2))

export async function taskProcess_async(wsSendTask, task, CEPFuncs) {
  let updatedTask = null;
  try {
    utils.logTask(task, "taskProcess_async", task.id);
    utils.logTask(task, "taskProcess_async task.processor.coprocessing", task.processor.coprocessing);
    const processorMatch = task.processor.initiatingProcessorId === NODE.id;
    const taskFunctionName = `${task.type}_async`
    if (processorMatch) {
      utils.logTask(task, "RxJS Task Processor from this processor so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (task.processor["command"] === "error") {
      utils.logTask(task, "RxJS Task Processor error so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (task.processor["command"] === "start") {
      utils.logTask(task, "RxJS Task Processor start so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (NODE.role === "coprocessor" && task.processor?.commandArgs?.sync) {
      // Seems a risk of CEP operating on sync creating loops
      // Could have a rule that sync do not operate on the same task
      // True that in this case we can just modify the task
      utils.logTask(task, "RxJS Task Coprocessor sync so skipping Task Fuction id:" + task.id);
      updatedTask = task;
    } else if (await taskFunctionExists_async(taskFunctionName)) {
      let fsmHolder = await getFsmHolder_async(task, activeTaskFsm.get(task.instanceId));
      let services = {};
      const servicesConfig = task.config.services;
      if (servicesConfig) {
        Object.keys(servicesConfig).forEach(async (key) => {
          // Dynamically import taskServices
          const environments = servicesConfig[key].environments;
          if (environments) {
            // Only try to load a service if it is expected to be on this processor
            if (environments.includes(NODE.environment)) {
              const type = servicesConfig[key].type;
              if (serviceTypes[type]) {
                services[key] = serviceTypes[type];
                const serviceName = serviceTypes[type]["moduleName"];
                if (await serviceExists_async(serviceName)) {
                  services[key]["module"] = await importService_async(serviceName);
                } else {
                  throw new Error(`Service ${serviceName} not found for ${task.id} config: ${JSON.stringify(servicesConfig)}`);
                }
              } else {
                throw new Error(`Servicetype ${type} not found in ${key} service of ${task.id} config: ${JSON.stringify(servicesConfig)}`);
              }
            }
          } else {
            throw new Error(`Servicetype ${key} service of ${task.id} has no environments`);
          }
        });
      }  
      let operators = {};
      const operatorsConfig = task.config.operators;
      if (operatorsConfig) {
        //console.log("operatorsConfig", JSON.stringify(operatorsConfig))
        Object.keys(operatorsConfig).forEach(async (key) => {
          // Dynamically import taskOperators
          const environments = operatorsConfig[key].environments;
          if (environments) {
            // Only try to load a operator if it is expected to be on this processor
            if (environments.includes(NODE.environment)) {
              const type = operatorsConfig[key].type;
              //console.log("operatorTypes", operatorTypes);
              if (operatorTypes[type]) {
                operators[key] = operatorTypes[type];
                const operatorName = operatorTypes[type]["moduleName"];
                if (await operatorExists_async(operatorName)) {
                  operators[key]["module"] = await importOperator_async(operatorName);
                  //console.log("operators", JSON.stringify(operators));
                } else {
                  throw new Error(`Operator ${operatorName} not found for ${task.id} config: ${JSON.stringify(operatorsConfig)}`);
                }
              } else {
                throw new Error(`Operatortype ${type} not found in ${key} operator of ${task.id} config: ${JSON.stringify(operatorsConfig)}`);
              }
            }
          } else {
            throw new Error(`Operatortype ${key} operator of ${task.id} has no environments`);
          }
        });
      }  
      const T = utils.createTaskValueGetter(task);
      const taskFunction = await importTaskFunction_async(taskFunctionName);
      // Option to run in background
      if (T("config.background")) {
        utils.logTask(task, `Processing ${task.type} in background`);
        taskFunction(wsSendTask, T, fsmHolder, CEPFuncs, services, operators);
      } else {
        utils.logTask(task, `Processing ${task.type} in state ${task?.state?.current}`);
        updatedTask = await taskFunction(wsSendTask, T, fsmHolder, CEPFuncs, services, operators);
      }
      utils.logTask(task, `Finished ${task.type} in state ${updatedTask?.state?.current}`);
    } else {
      utils.logTask(task, "RxJS Task Processor no Task Function for " + task.type);
    }
    // Create the CEP during the init of the task in the coprocessing step if a coprocessor
    if (task.processor["command"] === "init") {
      if (NODE.role !== "coprocessor" || (NODE.role === "coprocessor" && !task.processor.coprocessingDone)) {
        // How about overriding a match. createCEP needs more review/testing
        // Create two functions
        if (task.config?.ceps) {
          for (const key in task.config.ceps) {
            if (task.config.ceps[key]) {
              const CEPenvironments = task.config.ceps[key].environments;
              if (!CEPenvironments || CEPenvironments.includes(NODE.environment)) {
                utils.createCEP(CEPFuncs, CEPFunctions, task, key, task.config.ceps[key]);
              }
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
    if (NODE.role === "coprocessor") {
      if (updatedTask === null) {
        updatedTask = task;
        utils.logTask(updatedTask, "taskProcess_async null so task replaces updatedTask", updatedTask.id);
        // The updatedTask.processor will take effect in wsSendTask
        // We are not working at the Task scope here so OK to reuse this 
      } else if (updatedTask.command) {
        // This processor wants to make a change
        // The original processor will no longer see the change as coming from it
        utils.logTask(updatedTask, "taskProcess_async initiatingProcessorId updated");
        updatedTask.processor["initiatingProcessorId"] = NODE.id;
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
