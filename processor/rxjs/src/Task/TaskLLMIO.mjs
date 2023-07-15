/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { fetchTask_async } from "../fetchTask.mjs";
import { SubTaskLLM_async } from "./SubTaskLLM.mjs";

const TaskLLMIO_async = async function (taskName, wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(`${taskName} in state ${task.state.current}`);

  switch (task.state.current) {
    case "input":
      T("state.last", T("state.current"));
      T("state.current", "stop");
      return task;
    case "response":
      T("state.last", T("state.current"));
      T("state.current", "receiving");
      T("command", "update");
      // Here we update the task which has the effect of setting the state to receiving
      await fetchTask_async(task)
      // The response needs to be available for other tasks to point at
      const subTask = await SubTaskLLM_async(wsSendTask, task); 
      T("output.LLMtext", subTask.response.LLM);
      T("state.last", T("state.current"));
      T("state.current", "received");
      T("command", "update");
      break;
    case "start":
    case "received":
    case "display":
    case "wait":
    case "stop":
      console.log(`${taskName} does nothing in state ${task.state.current}`);
      return null;
    default:
      console.log("WARNING unknown state : " + task.state.current);
      return null;
  }

  console.log("Returning from TaskLLMIO "); // + response_text)
  //T("error", "Testing an error");
  return task;
};

export { TaskLLMIO_async };
