/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { activeTasksStore_async, activeCoProcessors, instancesStore_async, activeProcessors } from "./storage.mjs";
import taskSync_async from "./taskSync.mjs";
import { commandStart_async } from "./commandStart.mjs";
import { haveCoProcessor } from "../config.mjs";

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
    task.commandArgs = {
      init: initTask,
      prevInstanceId: task.instanceId,
    }
    await commandStart_async(task);
    //await taskStart_async(initTask, false, task.hub.sourceProcessorId, task.instanceId);
    // In theory the taskStart_async will update activeTasksStore_async and that will send the task to the correct processor(s)
  }
}

export async function commandError_async(task) {
  try {
    console.log(task.hub.requestId + " errorCommnad_async " + task.id);
    if (haveCoProcessor) {
      if (task.hub.coProcessingDone) {
        await errorTask_async(task); 
      } else {
        taskSync_async(task.instanceId, task);
      }
    } else {
      taskSync_async(task.instanceId, task)
        .then(async () => activeTasksStore_async.set(task.instanceId, task))  
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
