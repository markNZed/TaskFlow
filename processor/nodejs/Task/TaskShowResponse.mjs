/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { instancesStore_async } from "./../src/storage.mjs";
import { utils } from "../src/utils.mjs";

const TaskShowResponse_async = async function (wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log("TaskShowResponse name " + T("name"));

  let response = "";

  if (task.id.endsWith(".error")) {
    // Fetch the previous task
    const prevTask = await instancesStore_async.get(task.parentInstanceId)
    response = "ERROR: " + prevTask.error
    console.log("Set error from previous task", prevTask.error)
  }

  if (T("config.promptTemplate")) {
    console.log("Found promptTemplate");
    response += T("config.promptTemplate");
    console.log("Assembled response " + response);
  } else if (T("config.response")) {
    // Should not pass here if this is an error
    response = T("config.response");
  }

  // Ensure we do not overwrite the deltaState on the React Task Processor
  T("state.deltaState", undefined); // Should be centralized?
  T("response.text", response);
  T("updatedAt", Date.now()); // Should be centralized?
  console.log("Returning from TaskShowResponse");
  return task;
};

export { TaskShowResponse_async };
