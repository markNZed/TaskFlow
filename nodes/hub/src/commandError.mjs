/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { setActiveTask_async, getActiveTask_async, activeNodes } from "./storage.mjs";
import { commandStart_async } from "./commandStart.mjs";
import taskSync_async from "./taskSync.mjs";
import { utils } from "./utils.mjs";
import { taskRelease } from './shared/taskLock.mjs';

async function errorTask_async(task) {
  // Should be an assertion
  if (!task.hub.commandArgs?.errorTask) {
    utils.logTask(task, "task", task);
    throw new Error("Called errorTask_async on a task that is not errored");
  }
  // We are handling two lists for activeNodes
  // This is messy
  const nodeId = task.hub.initiatingNodeId;
  task.error.sourceNodeId = nodeId;
  let sourceNode = activeNodes.get(nodeId);
  console.log("sourceNode:", JSON.stringify(sourceNode, null, 2), "nodeId", nodeId);
  task.error.environments = [sourceNode.environment];
  let nextTaskId = task.hub.commandArgs.errorTask;
  utils.logTask(task, "errorTask_async task " + task.id + " error, next " + nextTaskId);
  await setActiveTask_async(task);

  const text = `${task.error.message} from task.id ${task.id} on node ${task.error.sourceNodeId} with environments ${task.error.environments}`;

  if (nextTaskId) {
    const initTask = {
      id: nextTaskId,
      user: {id: task.user.id},
      groupId: task?.groupId,
      familyId: task.familyId,
      response: {text: text, error: task.error},
      environments: task.environments,
      hub: {
        command: "error",
        initiatingNodeId: task.hub.initiatingNodeId,
        commandArgs: { unlock: true },
      },
    }
    task.hub.commandArgs = {
      init: initTask,
      authenticate: false, // Do we need this because request is not coming from internet but local node, would be better to detect this in the authentication?
      prevInstanceId: task?.meta?.errorHandlerInstanceId,
    };
    await commandStart_async(task);
    //await taskStart_async(initTask, false, task.hub.sourceNodeId, task.instanceId);
    // In theory the taskStart_async will update activeTasksStore and that will send the task to the correct node(s)
  }
}

export async function commandError_async(task) {
  try {
    utils.logTask(task, "errorCommnad_async " + task.id);
    const activeTask = await getActiveTask_async(task.instanceId);
    if (!activeTask) {
      throw new Error("No active task " + task.instanceId);
    }
    task = utils.deepMergeHub(activeTask, task, task.hub);
    if (!task.hub.commandArgs?.errorTask) {
      // We are receiving an error after coprocessing
      await taskSync_async(task.instanceId, task);
      await utils.hubActiveTasksStoreSet_async(setActiveTask_async, task);
      taskRelease(task.instanceId, "commandError_async");
    } else {
      await errorTask_async(task);
      taskRelease(task.instanceId, "commandError_async");
    }
  } catch (error) {
    const msg = `Error commandError_async task ${task.id}: ${error.message}`;
    console.error(msg);
    throw error;
  }
}
