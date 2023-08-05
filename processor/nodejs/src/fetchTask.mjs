/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TASKHUB_URL, processorId } from "../config.mjs";
import { toTask, fromTask } from "./taskConverterWrapper.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { utils } from "./utils.mjs";

export async function fetchTask_async(task) {

  const command = task.command;
  task = utils.taskToProcessor(task, processorId)
  const diffTask = utils.processorDiff(task);

  console.log("fetchTask " + command + " task: " + diffTask.id + " state: " + diffTask?.state?.current);

  try {
    const validatedTaskJsonString = fromTask(diffTask);
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
    const apiUrl = `${TASKHUB_URL}/api/task`;
    console.log(`API ${command} call to ${apiUrl}`);
    const response = await fetch(apiUrl, requestOptions);
    console.log(`API ${command} response status ${response.status}`);
    return response.ok;
    /*
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    } else {
      return response;
    }
    */
  } catch (error) {
    console.log(`Error in fetchTask_async ${command}: ${error}`);
    console.trace();
    throw new Error(`Error in fetchTask_async ${command}: ${error}`);
  }
}