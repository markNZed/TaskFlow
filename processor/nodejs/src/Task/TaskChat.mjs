/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { SubTaskLLM_async } from "./SubTaskLLM.mjs";
import { updateTask_async } from "../updateTask.mjs";

// Task may now be called just because th Task updates and this does not mean for sure that this Task Function should do something

// state === sending : this processor has control

const TaskChat_async = async function (wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(
    "TaskChat name " + T("name") + " state " + T("state.current")
  );

  if (T("state.current") === undefined || T("state.current") === "start") {
    console.log("Returning null");
    return null
  }

  if (T("state.current") === "sending") {
    T("response.text", null); // Avoid using previously stored response
    T("state.current", "receiving");
    T("state.deltaState", "receiving");
    // Here we update the task which has the effect of setting the state to receiving
    await updateTask_async(task)
    // Using a copy of the task because we may modify the request and we do not want to send
    // those changes back.
    const taskCopy = JSON.parse(JSON.stringify(task)); // deep copy
    const TC = utils.createTaskValueGetter(taskCopy);
    let msgs = TC("output.msgs");
    //console.log("msgs before", msgs);
    // Remove the assistant message
    msgs["conversation"].pop();
    // Remove the prompt
    const msgPrompt = msgs["conversation"].pop();
    TC("request.prompt", msgPrompt.text)
   // This will update the state on client 
    console.log("TaskChat sending");
    const subTask = await SubTaskLLM_async(wsSendTask, taskCopy);
    const response_text = await subTask.response.text_promise
    T("response.text", response_text);
    T("state.current", "input");
    T("state.deltaState", "input");
  }

  console.log("Returning from TaskChat_async", task.id);
  return task;
};

export { TaskChat_async };
