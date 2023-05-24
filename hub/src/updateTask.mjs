/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { toTask, fromTask } from "./taskConverterWrapper.mjs";

const updateTask_async = async (task) => {

  let messageJsonString;

  try {
    const validatedTaskJsonString = fromTask(task);
    const validatedTaskObject = JSON.parse(validatedTaskJsonString);
    messageJsonString = JSON.stringify({task: validatedTaskObject});
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

  const apiUrl = task.destination;
  console.log("API updateTask_async call to " + apiUrl)

  const response = await fetch(apiUrl, requestOptions)
    .then(response => {
        //console.log('HTTP response status:', response.status);
        //console.log('HTTP response headers:', response.headers);
        return response;
    })
    .catch(error => console.error('Error during fetch:', error));

  let updated_task = {};
  if (response) {
    const data = await response.json();

    try {
      updated_task = toTask(JSON.stringify(data.task));
    } catch (error) {
      throw new Error("Error while converting JSON to Task:" + error.message);
    }

    // Will need to move this somewhere where it can also deal with websocket messages
    if (updated_task.error) {
      let errorTask
      if (updated_task.config?.errorTask) {
        errorTask = updated_task.config.errorTask
      } else {
        // Assumes there is a default errorTask named error
        const strArr = updated_task.id.split('.');
        strArr[strArr.length - 1] = "error";
        errorTask = strArr.join('.');
      }
      if (!errorTask) {
          throw new Error("No error task defined for " + updated_task.id);
      }
      updated_task.nextTask = errorTask
      updated_task.state.done = true
      console.log("Task error " + task.id);
      // The task is done so process
      updated_task = await doneTask_async(updated_task) 
    }

    return updated_task;
  } else {
    console.log("No response from " + apiUrl);
    return null;
  }
};

export default updateTask_async;