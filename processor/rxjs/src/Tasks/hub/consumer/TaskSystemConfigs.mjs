/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { commandUpdate_async } from "#src/commandUpdate";

/*
  Register with systemConfig service and receive a promise that resolves when there is a change
  The resolve returns a new promise so we can await the next change
  Then update this task's shared.[type + "ConfigTree"] entry 
*/


// eslint-disable-next-line no-unused-vars
const TaskSystemConfigs_async = async function (wsSendTask, T, fsmHolder, CEPFuncs, services) {

  //console.log("TaskSystemConfigs services", services);
  const systemConfig = services["config"].module;
  //console.log("TaskSystemConfigs systemConfig", systemConfig);

  async function updateTree_async(systemConfig, type, wsSendTask, T) {
    utils.logTask(T(), "updateTree_async type:", type);
    const result = await systemConfig.buildTree_async(type); // Get updated tree
    // Calculate diff and update
    //const diff = { shared: { [type + "ConfigTree"]: result } };
    T("shared." + type + "ConfigTree", result);
    commandUpdate_async(wsSendTask, T()).then(() => {
      utils.logTask(T(), `Updating ${type}`);
    });
  }

  async function handleChangesForType(type, systemConfig, wsSendTask) {
    try {
      utils.logTask(T(), "systemConfig initialize type:", type);
      await updateTree_async(systemConfig, type, wsSendTask, T);
  
      // eslint-disable-next-line no-constant-condition
      while (true) {
        //utils.logTask(T(), "handleChangesForType awaiting", type);
  
        // Wait for change and immediately request for another change promise
        // eslint-disable-next-line no-unused-vars
        const id = await systemConfig.registerForChange_async(type);
  
        //utils.logTask(T(), "systemConfig change type:", type, id);
        updateTree_async(systemConfig, type, wsSendTask, T);
      }
    } catch (error) {
      console.error(`An error occurred while handling changes for ${type}:`, error);
    }
  }
  

  // Start handling changes for different types
  // This should not complete as the handleChangesForType is expected to run for the lifetime of the server
  // We set the task.config.background=true to avoid awaiting for this task 
  await Promise.all([
    handleChangesForType("tasks", systemConfig, wsSendTask),
    handleChangesForType("users", systemConfig, wsSendTask),
    handleChangesForType("groups", systemConfig, wsSendTask),
    handleChangesForType("tasktypes", systemConfig, wsSendTask)
  ]);

  return T();
};

export { TaskSystemConfigs_async };
