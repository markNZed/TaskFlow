/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { CEPFunctions } from "#src/CEPFunctions";
import { commandUpdate_async } from "#src/commandUpdate";
import { getActiveTask_async } from "#src/storage";
import TreeModel from 'tree-model';

/*
  For TaskChat we want to swap service type openaigpt for openaistub
  root.user.testing.zeroshot.start
*/

// eslint-disable-next-line no-unused-vars
const TaskCEPFamilyTree_async = async function (wsSendTask, T, fsmHolder, CEPFuncs, services, operators) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  // This sync the familyTree but we are not using this if we test via UI 
  // eslint-disable-next-line no-unused-vars
  async function CEPFamilyTree(functionName, wsSendTask, CEPinstanceId, task, args) {
    //utils.logTask(task, "CEPFamilyTree command", task.processor.command, task.id);
    // Only run this when going through the coprocessor the first time
    if (task.processor.command === "init" && !task.processor.coprocessingDone) {
      utils.logTask(task, "CEPFamilyTree adding");
      let CEPtask;
      // In this case we are starting the TaskCEPFamilyTree
      if (CEPinstanceId === task.instanceId) {
        CEPtask = task;
      } else {
        CEPtask = await getActiveTask_async(CEPinstanceId);
        if (!CEPtask) {
          throw new Error("No CEPtask found for " + CEPinstanceId);
        }
      }
      utils.logTask(task, "CEPFamilyTree CEPtask task?.state?.familyTree", JSON.stringify(CEPtask?.state?.familyTree, null, 2));
      const tree = new TreeModel();
      let root;
      if (CEPtask.state.familyTree) {
        root = tree.parse(CEPtask.state.familyTree);
      } else {
        root = tree.parse({id: CEPinstanceId, taskInstanceId: CEPinstanceId, taskId: CEPtask.id, type: CEPtask.type});
      }
      //utils.logTask(task, "familyTree", root);
      let node = root.first(node => node.model.id === task.instanceId);
      if (!node) {
        node = tree.parse({id: task.instanceId, taskInstanceId: task.instanceId, taskId: task.id, type: task.type});
        let parentNode;
        if (!task.meta.parentInstanceId) {
          utils.logTask(task, "No parentInstanceId", node);
        } else {
          parentNode = root.first(node => node.model.id === task.meta.parentInstanceId);
          if (parentNode) {
            parentNode.addChild(node);
            utils.logTask(task, "Found parentInstanceId so adding node");
          } else {
            utils.logTask(task, "No parentNode for parentInstanceId", task.meta.parentInstanceId);
          }
        }
        const updateDiff = {
          state: {
            familyTree: root.model,
          },
        };
        if (CEPinstanceId === task.instanceId) {
          task = utils.deepMerge(task, updateDiff);
          return task;
        } else {
          let syncUpdateTask = {
            command: "update",
            commandArgs: {
              sync: true,
              instanceId: CEPtask.instanceId,
              syncTask: updateDiff,
            }
          };
          await commandUpdate_async(wsSendTask, syncUpdateTask);
        }
      }
    }
  }

  // We can also register a CEP by declaring it in ./CEPFunctions.mjs
  CEPFunctions.register("CEPFamilyTree", CEPFamilyTree);

  return T();
};

export { TaskCEPFamilyTree_async };