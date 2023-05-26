/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { processorId } from "../config.mjs";

const syncTasks_async = async (wsSendTask, keyv, key, value) => {

  //console.log("syncTasks_async", key, value);

  const task = value;
  const has = await keyv.has(key);
  if (has) { 
    const activeTask = await keyv.get(key);
    // Here we could calculate the diff
  }

  // Passing in a null function is a way to disable sending tasks
  // This is used when we send th task with an HTTP request.
  if (wsSendTask !== null) {
    // If processor is setting task then send it to the hub
    if (!task?.source) {
      console.log("task missing source", key, value);
      throw new Error("task missing source");
    } else if (task.source === processorId) {
      // Not sure we need to do this - it should be done by sending update
      // Just sync in the background with websocket
      console.log("syncTasks_async updating", key, processorId);
      wsSendTask(task, "update");
    }
  }

};

export default syncTasks_async;