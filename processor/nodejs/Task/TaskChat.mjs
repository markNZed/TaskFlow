/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TaskLLMIO_async } from "./TaskLLMIO.mjs";
import { utils } from "../src/utils.mjs";
import { activeTasksStore_async } from "../src/storage.mjs";

// Task may now be called just because th Task updates and this does not mean for sure that this Task Function should do something

// state === sending : this processor has control

const TaskChat_async = async function (wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);
  console.log("TaskChat name " + T("name"));

  if (T("state.current") === "sending") {
    T("response.text", null); // Avoid using previously stored response
    T("state.current", "receiving");
    T("state.deltaState", "receiving");
    // This will update the state on client 
    console.log("TaskChat sending");
    await activeTasksStore_async.set(wsSendTask, task.instanceId, task);
    task = await TaskLLMIO_async(wsSendTask, task);
    T("state.current", "input");
    T("state.deltaState", "input");

  }

  console.log("Returning from TaskChat_async");
  return task;
};

export { TaskChat_async };
