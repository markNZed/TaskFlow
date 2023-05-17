/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TASKHUB_URL } from "../config.mjs";
import { toTask, fromTask } from "./taskConverterWrapper.mjs";

/*
let task = { id: startId, stackPtr: component_depth };
        if (threadId) {
          task["threadId"] = threadId;
        }

async function newTask_async(
  id,
  siblingTask = null
) {

    const sessionId = req.body.sessionId;
    let task = req.body.task;

    const startId = task.id;
    const threadId = task?.threadId;
    const component_depth = task.stackPtr;
    let groupId = task?.groupId;

// Need to add the option of pasing a sibling task
*/

export const startTask_async = async (userId, startId, siblingTask) => {

  let task = { id: startId };

  const sideband = {
  };

  let messageJsonString;

  try {
    const validatedTaskJsonString = fromTask(task);
    const validatedTaskObject = JSON.parse(validatedTaskJsonString);
    const validatedSiblingTaskJsonString = fromTask(siblingTask);
    const validatedSiblingTask = JSON.parse(validatedSiblingTaskJsonString);
    const messageObject = {
      ...sideband,
      task: validatedTaskObject,
      siblingTask: validatedSiblingTask,
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

  const apiUrl = `${TASKHUB_URL}/api/task/start`
  console.log("API call to " + apiUrl)

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
    return task;
  } catch (error) {
    console.log("Error while converting JSON to Task:", error, data);
  }
};
