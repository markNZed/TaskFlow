/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "./utils.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import taskSync_async from "./taskSync.mjs";
import RequestError from './routes/RequestError.mjs';

export async function commandInit_async(task, res) {
  let processorId = task.hub.sourceProcessorId;
  try {
    utils.logTask(task, "commandInit_async id:" + task.id + " from processorId:" + processorId);
    await taskSync_async(task.instanceId, task);
    utils.hubActiveTasksStoreSet_async(activeTasksStore_async, task);
    // We can use this for the websocket so there is no res provided in that case  
    if (res) {
      res.status(200).send("ok");
    }
  } catch (error) {
    const msg = `Error commandInit_async task ${task.id}: ${error.message}`;
    console.error(msg);
    if (res) {
      throw new RequestError(msg, 500, error);
    } else {
      throw new Error(msg);
    }
  }
  
}
