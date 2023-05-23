/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { processorId, TASKHUB_URL } from "../config.mjs";

const register_async = async () => {

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      processorId: processorId,
      environments: ["nodejs"]
   }),
  };

  const apiUrl = `${TASKHUB_URL}/api/register`
  console.log("API register_async call to " + apiUrl)

  const response = await fetch(apiUrl, requestOptions)
    .then(response => {
        //console.log('HTTP response status:', response.status);
        //console.log('HTTP response headers:', response.headers);
        return response;
    })
    .catch(error => console.error('Error during fetch:', error));

  // We should check the response - record the hubId

  try {
    const data = await response.json();
    console.log("data", data);
    return data;
  } catch (error) {
    const statusText = response.statusText; // Text description of the status
    const statusCode = response.status; // HTTP status 
    console.log("Error while converting JSON:", error.message, statusCode, statusText);
  }

};

export default register_async;