/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TASKHUB_URL, processorId } from "../config.mjs";
import { toTask, fromTask } from "./taskConverterWrapper.mjs";
import { activeTasksStore_async } from "../storage.mjs";
import { wsSendTask } from "./websocket.js";

export const startTask_async = async (userId, startId) => {

  let task = { id: startId, hub: {}};

  let messageJsonString;

  if (!task.processor) {
    throw new Error("Missing task.processor in startTask_async" + JSON.stringify(task));
  }

  // Clear down task commands as we do not want these coming back from the hub
  task.processor["command"] = "start";
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
      userId: userId,
    };
    messageJsonString = JSON.stringify(messageObject);
  } catch (error) {
    console.log("Error while converting Task to JSON:", error, task);
    return;
  }

  //console.log("messageJsonString", messageJsonString);

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: messageJsonString,
  };

  const apiUrl = `${TASKHUB_URL}/api/task`
  console.log("API startTask_async call to " + apiUrl)

  const response = await fetch(apiUrl, requestOptions)
    .then(response => {
        //console.log('HTTP response status:', response.status);
        //console.log('HTTP response headers:', response.headers);
        return response;
    })
    .catch(error => console.error('Error during fetch:', error));

  const data = await response.json();

  try {
    const task = toTask(JSON.stringify(data.task));
    activeTasksStore_async.set(task.instanceId, task);
    return task;
  } catch (error) {
    console.log("Error while converting JSON to Task:", error, data);
  }
};
