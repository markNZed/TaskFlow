/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { commandUpdate_async } from "#src/commandUpdate";
import { getActiveTask_async } from "#src/storage";
import TreeModel from 'tree-model';

/*
  For TaskChat we want to swap service type openaigpt for openaistub
  root.user.testing.zeroshot.start
*/

// This sync the familyTree but we are not using this if we test via UI 
// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {
  //utils.logTask(task, "CEPFamilyTree command", task.node.command, task.id);
  // Only run this when going through the coprocessor the first time
  if (task.node.command === "init" && !task.node.coprocessingDone) {
    let actions = [];
    utils.logTask(task, "CEPFamilyTree adding");
    let CEPtask;
    // In this case we are starting the TaskCEPFamilyTree
    if (CEPInstanceId === task.instanceId) {
      CEPtask = task;
    } else {
      CEPtask = await getActiveTask_async(CEPInstanceId);
      if (!CEPtask) {
        throw new Error("No CEPtask found for " + CEPInstanceId);
      }
    }
    utils.logTask(task, "CEPFamilyTree CEPtask task?.state?.familyTree", JSON.stringify(CEPtask?.state?.familyTree, null, 2));
    const tree = new TreeModel();
    let root;
    if (CEPtask.state.familyTree) {
      root = tree.parse(CEPtask.state.familyTree);
    } else {
      actions.push("Creating root" + CEPInstanceId);
      root = tree.parse({id: CEPInstanceId, taskInstanceId: CEPInstanceId, taskId: CEPtask.id, type: CEPtask.type});
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
          actions.push("Added child " + task.instanceId + " under " + task.meta.parentInstanceId)
        } else {
          utils.logTask(task, "No parentNode for parentInstanceId", task.meta.parentInstanceId);
        }
      }
      const updateDiff = {
        state: {
          familyTree: root.model,
        },
      };
      if (CEPInstanceId === task.instanceId) {
        task = utils.deepMerge(task, updateDiff);
        return task;
      } else {
        let syncUpdateTask = {
          command: "update",
          commandArgs: {
            sync: true,
            instanceId: CEPtask.instanceId,
            syncTask: updateDiff,
          },
          commandDescription: "Updating state.familyTree" + actions.join(", "),
        };
        await commandUpdate_async(wsSendTask, syncUpdateTask);
      }
    }
  }
}

export const CEPFamilyTree = {
  cep_async,
} 