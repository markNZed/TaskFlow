/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { commandUpdate_async } from "#src/commandUpdate";
import { NODE } from "#root/config";

/*
  Register with configFunctions service and receive a promise that resolves when there is a change
  The resolve returns a new promise so we can await the next change
  
  Rather than updating each variable we could do a single update when there are multiple variables
*/

// eslint-disable-next-line no-unused-vars
const TaskNodeConfigs_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  //console.log("TaskNodeConfigs services", services);
  const services = T("services");
  if (!services?.systemConfig?.module) {
    throw new Error("systemConfig module not found");
  }
  const configFunctions = services["systemConfig"].module;
  //console.log("TaskNodeConfigs configFunctions", configFunctions);

  async function updateTree_async(configFunctions, node, type, wsSendTask, T) {
    utils.logTask(T(), "updateTree_async type:", type);
    const result = await configFunctions.buildTree_async(services["systemConfig"], type); // Get updated tree
    // Calculate diff and update
    //const diff = { shared: { [type + "ConfigTree"]: result } };
    const varName = `shared.config-${node}-${type}`;
    T(varName, result)
    if (T("commandDescription")) {
      T("commandDescription", T("commandDescription") + ", " + varName);
    } else {
      T("commandDescription", "updateTree_async " + varName);
    }
    //console.log("Keys result", Object.keys(result));
  }

  async function handleChangesForType(node, type, configFunctions, wsSendTask) {
    try {
      utils.logTask(T(), "handleChangesForType initialize type:", type);
      await updateTree_async(configFunctions, node, type, wsSendTask, T);
  
      // eslint-disable-next-line no-constant-condition
      while (true) {
        //utils.logTask(T(), "handleChangesForType awaiting", type);
        T("commandDescription", null)
  
        // Wait for change and immediately request for another change promise
        // eslint-disable-next-line no-unused-vars
        const id = await configFunctions.registerForChange_async(type);
  
        //utils.logTask(T(), "configFunctions change type:", type, id);
        await updateTree_async(configFunctions, node, type, wsSendTask, T);

        T("commandArgs", {instanceId: T("instanceId"), sync: true, syncTask: {shared: T("shared")}});
        commandUpdate_async(wsSendTask, T()).then(() => {
          utils.logTask(T(), `Setting ${type}`);
        });
      
      }
    } catch (error) {
      console.error(`An error occurred while handling changes for ${type}:`, error);
    }
  }

  async function initializeForType(node, type, configFunctions, wsSendTask) {
    try {
      utils.logTask(T(), "initializeForType type:", type);
      await updateTree_async(configFunctions, node, type, wsSendTask, T);
    } catch (error) {
      console.error(`An error occurred while initializeForType ${type}:`, error);
    }
  }
 
  // Start handling changes for different types
  // This should not complete as the handleChangesForType is expected to run for the lifetime of the server
  // We set the task.systemConfig.background=true to avoid awaiting for this task 

  let promises = [];

  for (const store of services.systemConfig.stores) {
    promises.push(initializeForType(NODE.name, store, configFunctions, wsSendTask));
  }
  await Promise.all(promises);
  T("commandDescription", "");
  T("commandArgs", {instanceId: T("instanceId"), sync: true, syncTask: {shared: T("shared")}});
  utils.logTask(T(), "Shared:", T("shared"));
  commandUpdate_async(wsSendTask, T()).then(() => {
    utils.logTask(T(), "Initializing", services.systemConfig.stores);
  });
  

  promises = [];

  for (const store of services.systemConfig.stores) {
    promises.push(handleChangesForType(NODE.name, store, configFunctions, wsSendTask));
  }

  await Promise.all(promises);

  return null;
};

export { TaskNodeConfigs_async };
