/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TASKHUB_URL, processorId } from "../config.mjs";
import { toTask, fromTask } from "./taskConverterWrapper.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { utils } from "./utils.mjs";
//import { wsSendTask } from "./webSocket.js";

export async function fetchTask_async(task) {

  const command = task.command;
  task = utils.taskInProcessorOut(task, processorId)
  console.log("fetchTask " + command + " task: " + task.id + " state: " + task?.state?.current);

  try {
    const validatedTaskJsonString = fromTask(task);
    let validatedTaskObject = JSON.parse(validatedTaskJsonString);
    const messageObject = {
      task: validatedTaskObject,
      userId: task.user.id,
    };
    const messageJsonString = JSON.stringify(messageObject);
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: messageJsonString,
    };

    //wsSendTask(task);
    
    const apiUrl = `${TASKHUB_URL}/api/task`;
    console.log(`API ${command} call to ${apiUrl}`);
    const response = await fetch(apiUrl, requestOptions);
    console.log(`API ${command} response status ${response.status}`);
    return response.ok;
    
  } catch (error) {
    console.log(`Error in fetchTask_async ${command}: ${error}`);
    console.trace();
    throw new Error(`Error in fetchTask_async ${command}: ${error}`);
  }
}