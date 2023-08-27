/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { SubTaskLLM_async } from "./SubTaskLLM.mjs";

const TaskGeneratePersona_async = async function (wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  switch (task.state.current) {
    case "generated":
      console.log(`${task.type} does nothing in state ${task.state.current}`);
      return null
    case "start": {
      T("request.prompt", "Generate a random client profile");
      T("request.service.noStreaming", true);
      let subTask = await SubTaskLLM_async(wsSendTask, task);
      T("output.profile", subTask.response.LLM);
      T("request.service.systemMessage", "Generate a 100 word, single paragraph, summary of a client profile: ");
      T("request.prompt", T("output.profile"));
      const forget = T("request.service.forget");
      T("request.service.noStreaming", false);
      subTask = await SubTaskLLM_async(wsSendTask, task);
      T("output.summary", subTask.response.LLM);
      T("request.service.forget", forget);
      T("state.request", {}); // clear - do we need to do this here?
      T("state.last", T("state.current"));
      T("state.current", "generated");
      T("command", "update");
      break;
    }
    case "wait":
      console.log(`${task.type} waiting in state ${task.state.current}`);
      break;
    default:
      console.log("ERROR unknown state : " + task.state.current);
  }

  return task;
};

export { TaskGeneratePersona_async };
