/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async } from "./storage.mjs";
import { utils } from "./utils.mjs";

export async function syncCommand_async(wsSendTask, task, diff) { 
  console.log("syncCommand_async sync " + diff.instanceId);
  diff["command"] = "sync";
  // Copying before setting commandArgs avoids self reference
  diff["commandArgs"] = {syncTask: JSON.parse(JSON.stringify(diff))};
  delete diff.commandArgs.syncTask.command;
  const lastTask = await activeTasksStore_async.get(task.instanceId);
  if (!lastTask) {
    throw new Error("No diff found for " + diff.instanceId);
  }
  const mergedTask = utils.deepMerge(lastTask, diff);
  try {
    wsSendTask(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
