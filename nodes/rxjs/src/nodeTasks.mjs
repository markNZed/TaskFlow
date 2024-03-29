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
import { activeTaskFsm, serviceTypes_async, operatorTypes_async, cepTypes_async, ServicesMap, OperatorsMap, CEPsMap } from "./storage.mjs";
import { getFSMHolder_async } from "#src/taskFSM";
import { commandUpdate_async } from "#src/commandUpdate";

export async function nodeTasks_async(wsSendTask, task, CEPMatchMap) {
  const origTask = utils.deepClone(task);
  let T = utils.createTaskValueGetter(task);
  utils.debugTask(T(), "input");
  let nodeFunctionsInitialized = false;
  const syncNodeFunctions = T("node.commandArgs.syncNodeFunctions");
  try {
    utils.logTask(T(), "nodeTasks_async", T("id"));
    const taskFunctionName = `${T("type")}_async`
    if (T("node.command") === "error") {
      utils.logTask(T(), "RxJS error so skipping Task Fuction id:" + T("id"));
    } else if (T("node.command") === "start") {
      utils.logTask(T(), "RxJS start so skipping Task Fuction id:" + T("id"));
    } else if (!T("environments") || !T("environments").includes(NODE.environment)) {
      utils.logTask(T(), "Task is not configured to run on this node");
    } else if (syncNodeFunctions) {
      utils.logTask(T(), "Sync node functions so skip running Task on this update");
    // If this node is not a hub-coprocessor or hub-consumer then it must use this environment
    } else if (await taskFunctionExists_async(taskFunctionName)) {
      let initServices = false;
      if (T("services")) {
        Object.keys(T("services")).map(async (key) => {
          // Allows for changing the service on the fly
          if (T(`services.${key}.id`) !== T(`services.${key}.type`)) {
            initServices = true;
            console.log("nodeTasks_async initServices id changed ", T(`services.${key}.id`));
          } else {
            const module = ServicesMap.get(T(`services.${key}.moduleName`));
            if (module) {
              T(`services.${key}.module`, module);
            } else {
              initServices = true;
              console.log("nodeTasks_async initServices no module", T(`services.${key}.moduleName`));
            }
          }
        });
        //console.log("Restore services", T("services"));
      }
      let initOperators = false;
      if (T("operators")) {
        Object.keys(T("operators")).map(async (key) => {
          // Allows for changing the operator on the fly
          if (T(`operators.${key}.id`) !== T(`operators.${key}.type`)) {
            initOperators = true;
            console.log("nodeTasks_async initOperators id changed ", T(`operators.${key}.id`));
          } else {
            const module = OperatorsMap.get(T(`operators.${key}.moduleName`));
            if (module) {
              T(`operators.${key}.module`, module);
            } else {
              initOperators = true;
              console.log("nodeTasks_async initOperators no module", T(`operators.${key}.moduleName`));
            }
          }
        });
        //console.log("Restore operators", T("operators"));
        //console.log("OperatorsMap.keys", OperatorsMap.keys());
      }
      let FSMHolder = await getFSMHolder_async(T(), activeTaskFsm.get(T("instanceId")));
      let services = T("services") || {};
      if (initServices) {
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
            let environmentsUnknown = false;
            if (!environments) {
              if (!environments) {
                environments = T("environments");
                console.log(`Service ${key} has no environments so defaulting to Task environments`);
                environmentsUnknown = true;
              }
            }
            // Only try to load a service if it is expected to be on this node
            if (environments.includes(NODE.environment)) {
              if (!servicesConfig[key].type) {
                servicesConfig[key].type = key; // default to using the key as the type;
              }
              const type = servicesConfig[key].type; 
              //console.log("type", type);
              if (await serviceTypes_async.has(type)) {
                services[key] = await serviceTypes_async.get(type);
                if (Object.keys(servicesConfig[key]).length) {
                  services[key] = utils.deepMerge(services[key], servicesConfig[key]);
                }
                //console.log("services[key]", key, JSON.stringify(services[key], null, 2));
                const serviceName = services[key]["moduleName"] || key;
                if (await serviceExists_async(serviceName)) {
                  services[key]["module"] = await importService_async(serviceName);
                  ServicesMap.set(serviceName, services[key]["module"]);
                  nodeFunctionsInitialized = true;
                  console.log("nodeFunctionsInitialized services", serviceName);
                } else {
                  throw new Error(`Service ${serviceName} not found for ${T("id")} config: ${JSON.stringify(servicesConfig)}`);
                }
              } else {
                if (!environmentsUnknown) {
                  throw new Error(`Servicetype ${type} not found in ${key} service of ${T("id")} config: ${JSON.stringify(servicesConfig)}`);
                }
              }
            } else {
              console.log(`Service ${key} not expected to be on this node environment ${NODE.environment}`);
            }
          });
          // Wait for all the promises to resolve
          await Promise.all(promises);
          T("services", services);
          //console.log("init services", T("services"));
        }
      }
      if (initOperators) {
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
            let environments = operatorsConfig[key].environments;
            let environmentsUnknown = false;
            if (!environments) {
              environments = T("environments");
              console.log(`Operator ${key} has no environments so defaulting to Task environments`);
              environmentsUnknown = true;
            }
            if (environments) {
              // Only try to load an operator if it is expected to be on this node
              if (environments.includes(NODE.environment)) {
                if (!operatorsConfig[key].type) {
                  operatorsConfig[key].type = key; // default to using the key as the type
                }
                const type = operatorsConfig[key].type;
                if (await operatorTypes_async.has(type)) {
                  operators[key] = await operatorTypes_async.get(type);
                  if (Object.keys(operatorsConfig[key]).length) {
                    operators[key] = utils.deepMerge(operators[key], operatorsConfig[key]);
                  }
                  //console.log("operators[key]", key, JSON.stringify(operators[key], null, 2));
                  const operatorName = operators[key]["moduleName"] || key;
                  if (await operatorExists_async(operatorName)) {
                    operators[key]["module"] = await importOperator_async(operatorName);
                    OperatorsMap.set(operatorName, operators[key]["module"]);
                    nodeFunctionsInitialized = true;
                    console.log("nodeFunctionsInitialized operators", operatorName);
                  } else {
                    throw new Error(`Operator ${operatorName} of type ${type} not found for ${T("id")} config: ${JSON.stringify(operatorsConfig)}`);
                  }
                } else {
                  if (!environmentsUnknown) {
                    throw new Error(`Operatortype ${type} not found in ${key} operator of ${T("id")} config: ${JSON.stringify(operatorsConfig)}`);
                  }
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
        }
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
        // Even if we return null from taskFunction, if it modified T() then this will be seen 
        const updatedTask = await taskFunction(wsSendTask, T, FSMHolder, CEPMatchMap);
        if (updatedTask) {
          T = utils.createTaskValueGetter(updatedTask);
        } else if (updatedTask === null) {
          // ignore any command that might have been set inside the taskFunction
          if (T("command")) {
            utils.logTask(T(), `Ignoring ${T("command")} because null returned from taskFunction`);
            T("command", null);
          }
        }
      }
      utils.logTask(T(), `Finished ${T("type")} in state ${T("state.current")}`);
    } else {
      utils.logTask(T(), `RxJS no Task Function ${taskFunctionName} for ${T("type")}`);
    }
    // Create the CEP during the init of the task in the coprocessing step if a coprocessor
    if (T("node.command") === "init") {
      if (NODE.role !== "coprocessor" || (NODE.role === "coprocessor" && !T("node.coprocessed"))) {
        // How about overriding a match. CEPCreate needs more review/testing
        // Create two functions
        let ceps = T("ceps") || {};
        if (T("ceps")) {
          let cepsConfig = utils.deepClone(T("ceps"));
          console.log("cepsConfig", JSON.stringify(cepsConfig));
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
            let cepsInitialized = false;
            const promises = Object.keys(cepsConfig).map(async (key) => {
              // Dynamically import taskCeps
              const environments = cepsConfig[key].environments;
              if (environments) {
                // Only try to load a cep if it is expected to be on this node
                if (environments.includes(NODE.environment)) {
                  const type = cepsConfig[key].type || key;
                  //console.log("type", type);
                  if (await cepTypes_async.has(type)) {
                    ceps[key] = await cepTypes_async.get(type);
                    // We override the cepTypes_async with the values in T("ceps")
                    ceps[key] = utils.deepMerge(ceps[key], cepsConfig[key]);
                    //console.log("ceps[key]", key, JSON.stringify(ceps[key], null, 2));
                    const moduleName = ceps[key]["moduleName"] || key;
                    if (await CEPExists_async(moduleName)) {
                      ceps[key]["module"] = await importCEP_async(moduleName);
                      // The default function is cep_async
                      CEPregister(moduleName, ceps[key].module.cep_async);
                      nodeFunctionsInitialized = true;
                      cepsInitialized = true;
                      console.log("nodeFunctionsInitialized ceps:", moduleName);
                    } else {
                      throw new Error(`Cep ${moduleName} not found for ${T("id")} config: ${JSON.stringify(cepsConfig)}`);
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
            if (cepsInitialized) {
              T("ceps", ceps);
              console.log("init ceps", T("ceps"));
              CEPsMap.set(T("instanceId"), T("ceps"));
            }
          }
          for (const key in T("ceps")) {
            if (T(`ceps.${key}`)) {
              const CEPenvironments = T(`ceps.${key}.environments`);
              if (!CEPenvironments || CEPenvironments.includes(NODE.environment)) {
                console.log("CEPCreate", key);
                const match = T(`ceps.${key}.match`);
                CEPCreate(CEPMatchMap, T(), match, T(`ceps.${key}`));
              }
            }
          }
        }
      }
      //utils.logTask(T(), "nodeTasks_async CEPMatchMap", CEPMatchMap);
    }
    const cloneInitialized = T("shared.family.cloning") && (T("node.command") === "init" || T("node.command") === "join") && !T("commandArgs.sync");
    if (nodeFunctionsInitialized || cloneInitialized) {
      if (NODE.role !== "coprocessor" || (NODE.role === "coprocessor" && !T("node.coprocessed"))) {
        // Sync these changes
        // services/operators/ceps should be in a node namespace ?
        // Could have different nodes with the same service name but different config?
        const syncTask = {};
        let ST = utils.createTaskValueGetter(syncTask);
        if (T("services")) {
          ST("services", T("services"));
        }
        if (T("operators")) {
          ST("operators", T("operators"));
        }
        if (T("ceps")) {
          ST("ceps", T("ceps"));
        }
        let commandDescription;
        if (nodeFunctionsInitialized) {
          commandDescription = `Sync node functions on ${NODE.name}`
        }
        if (cloneInitialized) {
          ST("shared.family." + T("instanceId") + ".nodes." + NODE.id + ".initialized", true);
          commandDescription += ` Sync clone initialized ${NODE.name}`;
        }
        // Maybe this is problematic
        const syncUpdateTask = {
          command: "update",
          commandArgs: {
            syncNodeFunctions: true,
            sync: true,
            instanceId: T("instanceId"),
            syncTask: ST(),
            messageId: task.meta.messageId,
          },
          commandDescription,
        };
        // Don't await as we need to get the lock on this task
        commandUpdate_async(wsSendTask, syncUpdateTask);
      }
    }
  } catch (e) {
    console.log("Error in nodeTasks_async error:", e);
    console.log("Error in nodeTasks_async task:", T());
    // Strictly we should not be updating the task object in the node
    // Could set updatedTask.node.command = "error" ?
    T("error", {message: e.message});
    T("command", "update");
    T("commandArgs", {lockBypass: true});
    T("commandDescription", "Error in nodeTasks_async");
  }
  if (T("error") && T("node.command") !== "error") {
    // It is not natural to set the command to update when we have an error command
    T("command", "update");
    console.log("Task error: ", T("error"))
  }
  try {
    if (T("commandArgs.sync")) {
      utils.logTask(T(), "commandArgs.sync set");
      const command = T("command");
      const commandArgs = T("commandArgs");
      const commandDescription = T("commandDescription");
      T = utils.createTaskValueGetter({});
      T("command", command);
      T("commandArgs", commandArgs);
      T("commandDescription", commandDescription);
      let instanceId = commandArgs.syncTask.instanceId || T("instanceId");
      T("instanceId", instanceId);
      T("meta", {});
      T("node", {});
    }
    if (NODE.role === "coprocessor") {
      if (T() === null) {
        T = utils.createTaskValueGetter(origTask);
        utils.logTask(T(), "nodeTasks_async null so task replaces updatedTask", T("id"));
        // The updatedTask.node will take effect in wsSendTask
        // We are not working at the Task scope here so OK to reuse this 
      } else if (T("command")) {
        // This node wants to make a change
        // The original node will no longer see the change as coming from it
        utils.logTask(T(), "nodeTasks_async initiatingNodeId updated");
        T("node.initiatingNodeId", NODE.id);
      }
      if (!T("command")) {
        // Because wsSendTask is expecting task.command
        T("command", T("node.command"));
        T("commandArgs", T("node.commandArgs"));
        T("commandDescription", T("node.commandDescription"));
      }
      utils.debugTask(T(), "sending");
      wsSendTask(T());
    } else {
      // This needs more testing
      // When not a coprocessor what do we want to do?
      // Which command should we support here?
      // This is similar to the old do_task
      if (T("command")) {
        utils.debugTask(T(), "sending", T("command"), T("commandDescription"));
        utils.logTask(T(), "sending", T("command"), T("commandDescription"));
        T("node.initiatingNodeId", NODE.id);
        wsSendTask(T());
      } else {
        //utils.logTask(T(), "nodeTasks_async nothing to do");
      }
    }
  } catch (error) {
    utils.logTask(T(), "nodeTasks_async", T());
    console.error(`Command ${T("command")} failed to send ${error}`);
  }
  //wsSendTask(updatedTask);
  return T();
}
