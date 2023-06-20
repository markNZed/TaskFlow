/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TASKHUB_URL } from "../config.mjs";
import { toTask, fromTask } from "./taskConverterWrapper.mjs";
import { utils } from "./utils.mjs";

export const nextTask_async = async (task) => {

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

  const apiUrl = `${TASKHUB_URL}/api/task/next`
  console.log("API nextTask_async fetching " + apiUrl)

  const response = await fetch(apiUrl, requestOptions)
    .then(response => {
        //console.log('HTTP response status:', response.status);
        //console.log('HTTP response headers:', response.headers);
        return response;
    })
    .catch(error => console.error('Error during fetch:', error));

  // Not expecting a useful response, the hub will broadcast via ws
};
