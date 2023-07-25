/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { fetchTask_async } from "./fetchTask.mjs";

export async function updateCommand_async(wsSendTask, task) { 
  console.log("updateCommand_async sync " + task.instanceId);
  task["command"] = "update";
  const lastTask = await activeTasksStore_async.get(task.instanceId);
  if (!lastTask) {
    throw new Error("No task found for " + task.instanceId);
  }
  const updatedTask = utils.getObjectDifference(lastTask, task);
  updatedTask["id"] = task.id;
  updatedTask["instanceId"] = task.instanceId;
  updatedTask["command"] = task.command;
  updatedTask["commandArgs"] = task.commandArgs;
  updatedTask["processor"] = {};
  updatedTask["user"] = task.user;
  console.log("updateCommand_async updatedTask",updatedTask);
  try {
    //await fetchTask_async(updatedTask);
    wsSendTask(updatedTask);
  } catch (error) {
    console.error(`Command ${updatedTask.command} failed to fetch ${error}`);
  }
}
