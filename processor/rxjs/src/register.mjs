/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { processorId, TASKHUB_URL, CONFIG_DIR, COPROCESSOR, ENVIRONMENT } from "../config.mjs";
import { utils } from "./utils.mjs";

var serviceTypes = await utils.load_data_async(CONFIG_DIR, "servicetypes");
serviceTypes = utils.flattenObjects(serviceTypes);

const locale = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || process.env.LC_MESSAGES || 'en';
const language = locale.split('_')[0];

let hubId;

const register_async = async () => {

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      processorId,
      environment: ENVIRONMENT,
      // Because this processor can serve as a coprocessor it needs to deal with "start"
      commandsAccepted: ["update", "start", "init", "pong", "register", "error"],
      serviceTypes,
      coprocessor: COPROCESSOR,
      language,
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
    .catch(error => {
      console.error('Error during fetch:', error)
    });

  // We should check the response - record the hubId

  try {
    const data = await response.json();
    //console.log("data", data);
    hubId = data.hubId;
    return data;
  } catch (error) {
    const statusText = response?.statusText; // Text description of the status
    const statusCode = response?.status; // HTTP status 
    console.log("Error while converting JSON:", error.message, statusCode, statusText);
  }

};

export { register_async, hubId };