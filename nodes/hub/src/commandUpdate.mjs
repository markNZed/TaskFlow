/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { getActiveTask_async, setActiveTask_async, deleteActiveTask_async } from "./storage.mjs";
import taskSync_async from "./taskSync.mjs";
import { commandStart_async } from "./commandStart.mjs";
import { taskRelease } from './shared/taskLock.mjs';
import { NODE } from "../config.mjs";

async function doneTask_async(task) {
  utils.debugTask(task);
  let nextTaskId = task.node.commandArgs?.nextTaskId;
  utils.logTask(task, "Task " + task.id + " done, next " + nextTaskId);
  if (nextTaskId) {
    const initTask = {
      id: nextTaskId,
      user: {id: task.user.id},
      groupId: task?.groupId,
      familyId: task.familyId,
    }
    task.node.commandArgs = {
      init: initTask,
      authenticate: false, // Do we need this because request is not coming from internet but local node, would be better to detect this in the authentication?
    }
    await commandStart_async(task);
    // In theory commandStart_async will update activeTasksStore and that will send the task to the correct node(s)
  }
}

async function doUpdate(commandArgs, task) {
  utils.debugTask(task);
  if (commandArgs?.done) {
    utils.logTask(task, "Update task done " + task.id + " in state " + task.state?.current);
    // Send an update to validate done (Processor may have commandPending set)
    await Promise.all([
      taskSync_async(task.instanceId, task),
      doneTask_async(task)
    ]);
    // We should send a delete message to all the copies and also delete those (see Meteor protocol?)
    deleteActiveTask_async(task.instanceId);
  } else {
    task.meta.updateCount = task.meta.updateCount + 1;
    utils.logTask(task, "Update task " + task.id + " in state " + task.state?.current + " sync:" + commandArgs.sync + " instanceId:" + task.instanceId + " updateCount:" + task.meta.updateCount);
    await taskSync_async(task.instanceId, task)
    await utils.nodeActiveTasksStoreSet_async(setActiveTask_async, task);
  }
}

export async function commandUpdate_async(task) {
  utils.debugTask(task);
  if (task.instanceId === undefined) {
    throw new Error("Missing task.instanceId");
  }
  let nodeId = task.node.sourceNodeId;
  const commandArgs = task.node.commandArgs;
  let instanceId = task.instanceId;
  if (commandArgs?.syncTask?.instanceId) {
    instanceId = commandArgs.syncTask.instanceId;
  }
  utils.logTask(task, "commandUpdate_async messageId:", task?.meta?.messageId);
  try {
    utils.logTask(task, "commandUpdate_async from nodeId:" + nodeId);
    let activeTask = await getActiveTask_async(instanceId);
    utils.logTask(task, "commandUpdate_async got activeTask");
    if (!activeTask) {
      throw new Error("No active task " + instanceId);
    }
    if (commandArgs?.sync) {
      if (commandArgs?.done) {
        throw new Error("Not expecting sync of done task");
      }
      activeTask.meta["messageId"] = task.meta.messageId;
      activeTask.meta["prevMessageId"] = task.meta.prevMessageId;
      utils.debugTask(task, "before deepMerge");
      //utils.debugTask(activeTask, "before deepMerge activeTask");
      //utils.debugTask(commandArgs.syncTask, "before deepMerge commandArgs.syncTask");
      task = utils.deepMergeNode(activeTask, commandArgs.syncTask, task.node);
      utils.debugTask(task, "after deepMerge");
      task.node.commandArgs["syncTask"] = null;
      if (commandArgs.syncUpdate) {
        task.node.commandArgs["sync"] = null; // Map the sync to a "normal" update
      }
    } else {
      // There should be no need to do a merge here and it becomes very expensive
      //task = utils.deepMergeNode(activeTask, task, task.node);
    }
    task.meta.updateCount = activeTask.meta.updateCount;
    utils.logTask(task, task.meta.broadcastCount + " commandUpdate_async " + task.id);
    await doUpdate(commandArgs, task);       
  } catch (error) {
    const msg = `Error commandUpdate_async task ${task.id}: ${error.message}`;
    console.error(msg);
    utils.logTask(task, "commandUpdate_async task", task);
    if (NODE.mode === "development") {
      throw error;
    }
  } finally {
    // Always release the lock
    utils.logTask(task, "commandUpdate_async lock released instanceId:", instanceId);
    taskRelease(instanceId, "commandUpdate_async");
  }
}
