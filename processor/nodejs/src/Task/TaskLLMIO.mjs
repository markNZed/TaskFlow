/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { updateTask_async } from "../updateTask.mjs";
import { SubTaskLLM_async } from "./SubTaskLLM.mjs";

const TaskLLMIO_async = async function (taskName, wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(
    "TaskLLMIO name " + T("name") + " state " + T("state.current")
  );

  switch (task.state.current) {
    case "input":
      // Make user input available to other tasks an output of this task
      if (T("request.input")) {
        T("output.input", T("request.input"));
      }
      //console.log("Returning task state input " + JSON.stringify(task));
      T("state.last", T("state.current"));
      T("state.current", "stop");
      return task;
    case "response":
      T("state.last", T("state.current"));
      T("state.current", "receiving");
      // Here we update the task which has the effect of setting the state to receiving
      await updateTask_async(task)
      // The response needs to be available for other tasks to point at
      const subTask = await SubTaskLLM_async(wsSendTask, task); 
      T("response.text", subTask.response.text);
      T("output.text", subTask.response.text);
      T("state.last", T("state.current"));
      T("state.current", "received");
      break;
    case "start":
    case "received":
    case "display":
    case "wait":
    case "stop":
    default:
      console.log("WARNING unknown state : " + task.state.current);
      return null;
  }

  console.log("Returning from TaskLLMIO "); // + response_text)
  //T("error", "Testing an error");
  T("processor.command", "update");
  return task;
};

export { TaskLLMIO_async };
