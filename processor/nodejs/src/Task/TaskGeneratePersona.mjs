/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { SubTaskLLM_async } from "./SubTaskLLM.mjs";

const TaskGeneratePersona_async = async function (taskName, wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  switch (task.state.current) {
    case undefined:
      console.log(`${taskName} state.current is undefined`);
      return null
    case "start":
      T("request.prompt", "Generate a random client profile");
      T("request.noWebsocket", true);
      let subTask = await SubTaskLLM_async(wsSendTask, task);
      T("output.profile", subTask.response.text);
      T("request.systemMessage", "Generate a 100 word, single paragraph, summary of a client profile: ");
      T("request.prompt", T("output.profile"));
      const forget = T("request.forget");
      T("request.noWebsocket", false);
      //T("request.forget", false);
      subTask = await SubTaskLLM_async(wsSendTask, task);
      T("output.summary", subTask.response.text);
      T("request.forget", forget);
      T("request", {}); // clear - do we need to do this here?
      T("state.last", T("state.current"));
      T("state.current", "generated");
      break;
    default:
      console.log("ERROR unknown state : " + task.state.current);
  }

  console.log(`Returning from ${taskName}`);
  T("command", "update");
  return task;
};

export { TaskGeneratePersona_async };
