/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TASKHUB_URL, processorId } from "../config.mjs";
import { toTask, fromTask } from "./taskConverterWrapper.mjs";

export async function fetchTask_async(task) {
    if (!task.command) {
      throw new Error(`Missing task.command`);
    }
    const command = task.command;
    // Clear down task commands as we do not want these coming back from the hub
    task.processor["command"] = command;
    task["command"] = null;
    if (task.commandArgs) {
      // Deep copy because we are going to clear
      task.processor["commandArgs"] = JSON.parse(JSON.stringify(task.commandArgs));
      task.commandArgs = null;
    }
    task.processor["id"] = processorId;
  
    try {
      const validatedTaskJsonString = fromTask(task);
      const validatedTaskObject = JSON.parse(validatedTaskJsonString);
      const messageObject = {
        task: validatedTaskObject,
        userId: task.userId,
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
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Error in fetchTask_async ${command}: ${error}`);
    }
  }