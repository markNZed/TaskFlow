/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";
import { commandUpdate_async } from "../commandUpdate.mjs";
import { activeTasksStore_async } from "../storage.mjs";

/*
  For TaskChat we want to swap service type openaigpt for openaistub
  root.user.testing.zeroshot.start
*/

const TaskSystemTest_async = async function (taskName, wsSendTask, task, CEPFuncs) {
  const T = utils.createTaskValueGetter(task);

  function serviceStub(functionName, wsSendTask, CEPinstanceId, task, args) {
    const key = args.key;
    const value = args.value;
    const type = args.type;
    //task.config.services
    if (task.processor.command === "start") {
      for (const service of task.config.services) {
        if (service.type === type) {
          service[key] = value;
          task.config.subtasks.SubTaskLLM.useCache = false;
        }
        // Your code logic for each service entry
      }
      console.log("task.config.services", type, key, value);
      return;
    }
  }

  async function familyIds(functionName, wsSendTask, CEPinstanceId, task, args) {
    if (task.processor.command === "start" && task.instanceId !== CEPinstanceId) {
      // Sending to the TaskSystemTest
      const CEPtask = await activeTasksStore_async.get(CEPinstanceId);
      let familyIds = {};
      if (CEPtask.state.familyIds) {
        familyIds = JSON.parse(JSON.stringify(CEPtask.state.familyIds));
      }
      if (!Object.keys(familyIds).includes(task.instanceId)) {
        familyIds[task.instanceId] = {id: task.id};
        let diff = {
          state: {
            familyIds,
          }
        };
        console.log("familyIds adding instanceId", familyIds);
        await commandUpdate_async(wsSendTask, CEPtask, diff);
      }
    }
  }


  // This shows dynamically registering a CEP 
  // We can also register a CEP by declaring it in ./CEPFunctions.mjs
  CEPFunctions.register("serviceStub", serviceStub);
  CEPFunctions.register("familyIds", familyIds);

  console.log(`${taskName} in state ${task?.state?.current}`);

  return task;
};

export { TaskSystemTest_async };