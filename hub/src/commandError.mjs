/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { activeTasksStore_async, instancesStore_async, activeProcessors } from "./storage.mjs";
import { commandStart_async } from "./commandStart.mjs";
import taskSync_async from "./taskSync.mjs";
import RequestError from './routes/RequestError.mjs';
import { utils } from "./utils.mjs";

async function errorTask_async(task) {
  // Should be an assertion
  if (!task.hub.commandArgs?.errorTask) {
    console.log("task", task);
    throw new Error("Called errorTask_async on a task that is not errored");
  }
  const processorId = task.hub.sourceProcessorId;
  task.error.sourceProcessorId = processorId;
  const sourceProcessor = activeProcessors.get(processorId);
  task.error.environments = sourceProcessor.environments;
  let nextTaskId = task.hub.commandArgs.errorTask;
  console.log("Task " + task.id + " error, next " + nextTaskId);
  await instancesStore_async.set(task.instanceId, task);

  const text = `${task.error.message} from task.id ${task.id} on processor ${task.error.sourceProcessorId} with environments ${task.error.environments}`;

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
        sourceProcessorId: task.hub.sourceProcessorId,
      },
    }
    task.hub.commandArgs = {
      init: initTask,
      prevInstanceId: task.instanceId,
      authenticate: false, // Do we need this because request is not coming from internet but local processor, would be better to detect this in the authentication?
    };
    await commandStart_async(task);
    //await taskStart_async(initTask, false, task.hub.sourceProcessorId, task.instanceId);
    // In theory the taskStart_async will update activeTasksStore_async and that will send the task to the correct processor(s)
  }
}

export async function commandError_async(task, res) {
  try {
    console.log(task.hub.requestId + " errorCommnad_async " + task.id);
    const activeTask = await activeTasksStore_async.get(task.instanceId);
    if (!activeTask) {
      throw new Error("No active task " + task.instanceId);
    }
    task = utils.deepMergeHub(activeTask, task, task.hub);
    if (!task.hub.commandArgs?.errorTask) {
      // We are receiving an error after coprocessing
      await taskSync_async(task.instanceId, task);
      utils.hubActiveTasksStoreSet_async(activeTasksStore_async, task);
    } else {
      await errorTask_async(task);
    }
  } catch (error) {
    const msg = `Error commandError_async task ${task.id}: ${error.message}`;
    console.error(msg);
    if (res) {
      throw new RequestError(msg, 500, error);
    } else {
      throw new Error(msg);
    }
  }
}
