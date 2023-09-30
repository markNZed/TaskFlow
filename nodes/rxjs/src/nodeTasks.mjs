/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { importTaskFunction_async, taskFunctionExists_async } from "./nodeTaskFunctions.mjs";
import { importService_async, serviceExists_async } from "./nodeServices.mjs";
import { importOperator_async, operatorExists_async } from "./nodeOperators.mjs";
import { importCEP_async, CEPExists_async } from "./nodeCEPs.mjs";
import { CEPregister, CEPCreate } from "./taskCEPs.mjs";
import { utils } from "./utils.mjs";
import { NODE } from "../config.mjs";
import { activeTaskFsm, serviceTypes_async, operatorTypes_async, cepTypes_async, ServicesMap, OperatorsMap, CEPsMap, CEPFunctionMap } from "./storage.mjs";
import { getFSMHolder_async } from "#src/taskFSM";

export async function taskProcess_async(wsSendTask, task, CEPMatchMap) {
  let updatedTask = null;
  const T = utils.createTaskValueGetter(task);
  try {
    utils.logTask(T(), "taskProcess_async", T("id"));
    utils.logTask(T(), "taskProcess_async processor.coprocessing", T("processor.coprocessing"));
    const processorMatch = T("processor.initiatingProcessorId") === NODE.id;
    const taskFunctionName = `${T("type")}_async`
    if (processorMatch) {
      utils.logTask(T(), "This was the initiatingProcessorId so skipping Task Fuction id:" + T("id"));
      updatedTask = T();
    } else if (T("processor.command") === "error") {
      utils.logTask(T(), "RxJS Processor error so skipping Task Fuction id:" + T("id"));
      updatedTask = T();
    } else if (T("processor.command") === "start") {
      utils.logTask(T(), "RxJS Processor start so skipping Task Fuction id:" + T("id"));
      updatedTask = T();
    } else if (NODE.role === "coprocessor" && T("processor.commandArgs.sync")) {
      // Seems a risk of CEP operating on sync creating loops
      // Could have a rule that sync do not operate on the same task
      // True that in this case we can just modify the task
      utils.logTask(T(), "RxJS Task Coprocessor sync so skipping Task Fuction id:" + T("id"));
      updatedTask = T();
    } else if (NODE.role === "coprocessor" && !T("environments").includes(NODE.environment)) {
      utils.logTask(T(), "Task is not configured to run on coprocessor");
      updatedTask = T();
    // If this is not a coprocessor then it must use this environment
    } else if (await taskFunctionExists_async(taskFunctionName)) {
      let FSMHolder = await getFSMHolder_async(T(), activeTaskFsm.get(T("instanceId")));
      let services = T("services") || {};
      if (T("processor.command") === "init") {
        let servicesConfig = utils.deepClone(T("services"));
        if (servicesConfig) {
          if (servicesConfig["*"]) {
            for await (const [key, value] of serviceTypes_async.iterator()) {
              if (value) {
                servicesConfig[key] = value;
                servicesConfig[key]["type"] = key;
              } else {
                throw new Error(`seviceType undefined ${key}`);
              }
            }
            delete servicesConfig["*"];
          }
          const promises = Object.keys(servicesConfig).map(async (key) => {
            // Dynamically import taskServices
            let environments = servicesConfig[key].environments;
            if (!environments) {
              environments = [NODE.environment];
              console.log(`Service ${key} has no environments so it runs everywhere`);
            }
            // Only try to load a service if it is expected to be on this processor
            if (environments.includes(NODE.environment)) {
              const type = servicesConfig[key].type;
              //console.log("type", type);
              if (await serviceTypes_async.has(type)) {
                services[key] = await serviceTypes_async.get(type);
                services[key] = utils.deepMerge(services[key], servicesConfig[key]);
                //console.log("services[key]", key, JSON.stringify(services[key], null, 2));
                const serviceName = services[key]["moduleName"];
                if (await serviceExists_async(serviceName)) {
                  services[key]["module"] = await importService_async(serviceName);
                } else {
                  throw new Error(`Service ${serviceName} not found for ${T("id")} config: ${JSON.stringify(servicesConfig)}`);
                }
              } else {
                throw new Error(`Servicetype ${type} not found in ${key} service of ${T("id")} config: ${JSON.stringify(servicesConfig)}`);
              }
            } else {
              console.log(`Service ${key} not expected to be on this processor environment ${NODE.environment}`);
            }
          });
          // Wait for all the promises to resolve
          await Promise.all(promises);
          T("services", services);
          //console.log("init services", T("services"));
          ServicesMap.set(T("instanceId"), T("services"));
        }
        let operators = T("operators") || {};
        let operatorsConfig = utils.deepClone(T("operators"));
        if (operatorsConfig) {
          if (operatorsConfig["*"]) {
            for await (const [key, value] of operatorTypes_async.iterator()) {
              if (value) {
                operatorsConfig[key] = value;
                operatorsConfig[key]["type"] = key;
              } else {
                throw new Error(`seviceType undefined ${key}`);
              }
            }
            delete operatorsConfig["*"];
          }
          //console.log("operatorsConfig", JSON.stringify(operatorsConfig))
          const promises = Object.keys(operatorsConfig).map(async (key) => {
            // Dynamically import taskOperators
            const environments = operatorsConfig[key].environments;
            if (environments) {
              // Only try to load an operator if it is expected to be on this processor
              if (environments.includes(NODE.environment)) {
                const type = operatorsConfig[key].type;
                if (await operatorTypes_async.has(type)) {
                  operators[key] = await operatorTypes_async.get(type);
                  operators[key] = utils.deepMerge(operators[key], operatorsConfig[key]);
                  //console.log("operators[key]", key, JSON.stringify(operators[key], null, 2));
                  const operatorName = operators[key]["moduleName"];
                  if (await operatorExists_async(operatorName)) {
                    operators[key]["module"] = await importOperator_async(operatorName);
                    //console.log("operators", operators);
                  } else {
                    throw new Error(`Operator ${operatorName} not found for ${T("id")} config: ${JSON.stringify(operatorsConfig)}`);
                  }
                } else {
                  throw new Error(`Operatortype ${type} not found in ${key} operator of ${T("id")} config: ${JSON.stringify(operatorsConfig)}`);
                }
              }
            } else {
              throw new Error(`Operatortype ${key} operator of ${T("id")} has no environments`);
            }
          });
          // Wait for all the promises to resolve
          await Promise.all(promises);
          T("operators", operators);
          //console.log("init operators", T("operators"));
          OperatorsMap.set(T("instanceId"), T("operators"));
        }
      } else {
        T("services", ServicesMap.get(T("instanceId")));
        //console.log("services restored" , T("services"));
        T("operators", OperatorsMap.get(T("instanceId")));
        //console.log("operators restored", T("operators"));
      }
      const taskFunction = await importTaskFunction_async(taskFunctionName);
      // Option to run in background
      if (T("config.background")) {
        utils.logTask(T(), `Processing ${T("type")} in background`);
        taskFunction(wsSendTask, T, FSMHolder, CEPMatchMap).catch(error => {
          console.error('Error processing in background:', error);
        });
      } else {
        utils.logTask(T(), `Processing ${T("type")} in state ${T("state.current")}`);
        updatedTask = await taskFunction(wsSendTask, T, FSMHolder, CEPMatchMap);
      }
      utils.logTask(T(), `Finished ${T("type")} in state ${updatedTask?.state?.current}`);
    } else {
      utils.logTask(T(), "RxJS Processor no Task Function for " + T("type"));
    }
    // Create the CEP during the init of the task in the coprocessing step if a coprocessor
    if (T("processor.command") === "init") {
      if (NODE.role !== "coprocessor" || (NODE.role === "coprocessor" && !T("processor.coprocessingDone"))) {
        // How about overriding a match. CEPCreate needs more review/testing
        // Create two functions
        let ceps = {};
        if (T("ceps")) {
          let cepsConfig = utils.deepClone(T("ceps"));
          //console.log("cepsConfig", JSON.stringify(cepsConfig))
          if (cepsConfig) {
            if (cepsConfig["*"]) {
              for await (const [key, value] of cepTypes_async.iterator()) {
                if (value) {
                  cepsConfig[key] = value;
                  cepsConfig[key]["type"] = key;
                } else {
                  throw new Error(`seviceType undefined ${key}`);
                }
              }
              delete cepsConfig["*"];
            }
            const promises = Object.keys(cepsConfig).map(async (key) => {
              // Dynamically import taskCeps
              const environments = cepsConfig[key].environments;
              if (environments) {
                // Only try to load a cep if it is expected to be on this processor
                if (environments.includes(NODE.environment)) {
                  const type = cepsConfig[key].type;
                  //console.log("type", type);
                  if (await cepTypes_async.has(type)) {
                    ceps[key] = await cepTypes_async.get(type);
                    ceps[key] = utils.deepMerge(ceps[key], cepsConfig[key]);
                    //console.log("ceps[key]", key, JSON.stringify(ceps[key], null, 2));
                    const cepName = ceps[key]["moduleName"];
                    if (await CEPExists_async(cepName)) {
                      ceps[key]["module"] = await importCEP_async(cepName);
                      // Register the function using old method
                      // Eventaully we should pull the function from CEPsMap I guess
                      if (!ceps[key].functionName) {
                        ceps[key]["functionName"] = cepName;
                      }
                      CEPregister(cepName, ceps[key].module.cep_async);
                      // This is another hack to work with the current implementation
                      T(`ceps.${key}.functionName`, cepName);
                      //console.log("T ceps:", T("ceps"));
                    } else {
                      throw new Error(`Cep ${cepName} not found for ${T("id")} config: ${JSON.stringify(cepsConfig)}`);
                    }
                  } else {
                    throw new Error(`Ceptype ${type} not found in ${key} cep of ${T("id")} config: ${JSON.stringify(cepsConfig)}`);
                  }
                }
              } else {
                throw new Error(`Ceptype ${key} cep of ${T("id")} has no environments`);
              }
            });
            // Wait for all the promises to resolve
            await Promise.all(promises);
            T("ceps", ceps);
            //console.log("init ceps", T("ceps"));
            CEPsMap.set(T("instanceId"), T("ceps"));
          }
          for (const key in T("ceps")) {
            if (T(`ceps.${key}`)) {
              const CEPenvironments = T(`ceps.${key}.environments`);
              if (!CEPenvironments || CEPenvironments.includes(NODE.environment)) {
                //console.log("ceps", key, T(`ceps.${key}`));
                const match = T(`ceps.${key}.match`);
                CEPCreate(CEPMatchMap, CEPFunctionMap, T(), match, T(`ceps.${key}`));
              }
            }
          }
        }
      }
      //utils.logTask(T(), "taskProcess_async CEPMatchMap", CEPMatchMap);
    }
  } catch (e) {
    console.error(e);
    updatedTask = T();
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
      let instanceId = commandArgs.syncTask.instanceId || T("instanceId");
      updatedTask["instanceId"] = instanceId;
      updatedTask["meta"] = {};
      updatedTask["processor"] = {};
    }
    if (NODE.role === "coprocessor") {
      if (updatedTask === null) {
        updatedTask = T();
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
        updatedTask.command = T("processor.command");
        updatedTask.commandArgs = T("processor.commandArgs");
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
