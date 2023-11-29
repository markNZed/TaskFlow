/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { setActiveTask_async } from "./storage.mjs";
import taskSync_async from "./taskSync.mjs";
import taskStart_async from "./taskStart.mjs";
import { NODE } from "../config.mjs";
import { taskRelease } from './shared/taskLock.mjs';

export async function commandStart_async(task) {
  utils.debugTask(task);
  const commandArgs = task.node.commandArgs;
  let initiatingNodeId = task.node.initiatingNodeId || NODE.id;
  try {
    utils.logTask(task, "commandStart_async from initiatingNodeId:" + initiatingNodeId);
    let initTask;
    let authenticate = true;
    if (commandArgs.init) {
      initTask = commandArgs.init;
      if (commandArgs.authenticate !== undefined) {
        authenticate = commandArgs.authenticate;
      }
    } else {
      initTask = {
        id: commandArgs.id,
      };
    }
    if (task?.user?.id) {
      initTask["user"] = { id: task.user.id };
    }
    if (task.node.commandDescription) {
      initTask["commandDescription"] = task.node.commandDescription;
    }
    initTask["meta"] = initTask.meta || {};
    if (task?.meta?.messageId) {
      initTask.meta["prevMessageId"] = task.meta.messageId;
    } 
    initTask.meta["messageId"] = utils.nanoid8();
    if (commandArgs.prevInstanceId) {
      initTask.meta["prevInstanceId"] = commandArgs.prevInstanceId;
    }
    initTask["tribeId"] = initTask.tribeId || task.tribeId;
    //utils.logTask(task, "commandStart_async coprocessed:", task.node.coprocessed, "initTask", initTask);
    const prevInstanceId = commandArgs.prevInstanceId || task.instanceId;
    if (NODE.haveCoprocessor) {
      if (task.node.coprocessed) {
        // Need to await so the try/catch will catch errors
        await taskStart_async(initTask, authenticate, initiatingNodeId, prevInstanceId)
          .then(async (startTask) => {
            await taskSync_async(startTask.instanceId, startTask);
            await utils.nodeActiveTasksStoreSet_async(setActiveTask_async, startTask);
            taskRelease(task.instanceId, "commandStart_async");
          })
      } else {
        await taskSync_async(task.instanceId, task);
        // Start should not function as an update. Could get out of sync when using task to start another task.
      }
    } else {
      // Need to await so the try/catch will catch errors
      await taskStart_async(initTask, authenticate, initiatingNodeId, prevInstanceId)
        .then(async (startTask) => {
          await taskSync_async(startTask.instanceId, startTask);
          await utils.nodeActiveTasksStoreSet_async(setActiveTask_async, startTask);
          taskRelease(task.instanceId, "commandStart_async");
        })
    }
  } catch (error) {
    const msg = `Error commandStart_async task ${task.id}: ${error.message}`;
    console.error(msg);
    throw error;
  }
  
}
