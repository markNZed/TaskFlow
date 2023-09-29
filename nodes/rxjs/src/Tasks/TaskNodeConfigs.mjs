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

  //console.log("TaskNodeConfigs services", services);
  const services = T("services");
  if (!services?.config?.module) {
    throw new Error("config module not found");
  }
  const configFunctions = services["config"].module;
  //console.log("TaskNodeConfigs configFunctions", configFunctions);

  async function updateTree_async(configFunctions, node, type, wsSendTask, T) {
    utils.logTask(T(), "updateTree_async type:", type);
    const result = await configFunctions.buildTree_async(services["config"], type); // Get updated tree
    // Calculate diff and update
    //const diff = { shared: { [type + "ConfigTree"]: result } };
    let capitalizedNode = node.charAt(0).toUpperCase() + node.slice(1);
    let capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    const varName = "shared." + "configTree" + capitalizedNode + capitalizedType;
    T(varName, result)
    T("commandDescription", `Updating ${varName}`);
    console.log("Keys result", Object.keys(result));
    commandUpdate_async(wsSendTask, T()).then(() => {
      utils.logTask(T(), `Setting ${type}`);
    });
  }

  async function handleChangesForType(node, type, configFunctions, wsSendTask) {
    try {
      utils.logTask(T(), "configFunctions initialize type:", type);
      await updateTree_async(configFunctions, node, type, wsSendTask, T);
  
      // eslint-disable-next-line no-constant-condition
      while (true) {
        //utils.logTask(T(), "handleChangesForType awaiting", type);
  
        // Wait for change and immediately request for another change promise
        // eslint-disable-next-line no-unused-vars
        const id = await configFunctions.registerForChange_async(type);
  
        //utils.logTask(T(), "configFunctions change type:", type, id);
        updateTree_async(configFunctions, node, type, wsSendTask, T);
      }
    } catch (error) {
      console.error(`An error occurred while handling changes for ${type}:`, error);
    }
  }
  

  // Start handling changes for different types
  // This should not complete as the handleChangesForType is expected to run for the lifetime of the server
  // We set the task.config.background=true to avoid awaiting for this task 

  let promises = [];

  for (const store of services.config.stores) {
    promises.push(handleChangesForType(NODE.name, store, configFunctions, wsSendTask));
  }

  await Promise.all(promises);

  return T();
};

export { TaskNodeConfigs_async };
