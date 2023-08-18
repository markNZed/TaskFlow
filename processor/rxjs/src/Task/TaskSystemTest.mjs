/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";
import { commandUpdate_async } from "../commandUpdate.mjs";
import { activeTasksStore_async } from "../storage.mjs";
import TreeModel from 'tree-model';

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
    if (task.processor.command === "init" && task?.config?.services) {
      for (const service of task.config.services) {
        if (service.type === type) {
          service[key] = value;
          task.config.subtasks.SubTaskLLM.useCache = false;
        }
        // Your code logic for each service entry
      }
      utils.logTask(task, "task.config.services", type, key, value);
      return;
    }
  }

  // This sync the familyTree but we are not using this if we test via UI 
  async function familyIds(functionName, wsSendTask, CEPinstanceId, task, args) {
    utils.logTask(task, "familyIds command", task.processor.command);
    if (task.processor.command === "init") {
      let CEPtask;
      // In this case we are starting the TaskSystemTest
      if (CEPinstanceId === task.instanceId) {
        CEPtask = task;
      } else {
        CEPtask = await activeTasksStore_async.get(CEPinstanceId);
      }
      const familyTree = new TreeModel();
      let root;
      if (CEPtask.state.familyTree) {
        root = familyTree.parse(CEPtask.state.familyTree);
      } else {
        root = familyTree.parse({id: CEPinstanceId, taskInstanceId: CEPinstanceId, taskId: CEPtask.id, type: CEPtask.type});
      }
      //utils.logTask(task, "familyTree", familyTree, root);
      let node = root.first(node => node.model.id === task.instanceId);
      if (!node) {
        node = familyTree.parse({id: task.instanceId, taskInstanceId: task.instanceId, taskId: task.id, type: task.type});
        if (!task.meta.parentInstanceId) {
          utils.logTask(task, "No parentInstanceId", node);
          root.addChild(node);
        } else {
          utils.logTask(task, "Found parentInstanceId", node);
          const parentNode = root.first(node => node.model.id === task.meta.parentInstanceId);
          parentNode.addChild(node);
        }
        let diff = {
          state: {
            familyTree: root.model,
          }
        };
        utils.logTask(task, "familyTree diff", diff);
        await commandUpdate_async(wsSendTask, CEPtask, diff);
      }
    }
  }

  // We can also register a CEP by declaring it in ./CEPFunctions.mjs
  CEPFunctions.register("serviceStub", serviceStub);
  CEPFunctions.register("familyIds", familyIds);

  utils.logTask(task, `${taskName} in state ${task?.state?.current}`);

  return task;
};

export { TaskSystemTest_async };