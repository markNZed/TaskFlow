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

const TaskChat_async = async function (taskName, wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(
    "TaskChat name " + T("name") + " state " + T("state.current")
  );

  // Could return msgs instead of response.text
  switch (task.state.current) {
    case "mentionAddress":
    case "sending":
      T("state.last", T("state.current"));
      T("state.current", "receiving");
      T("lockBypass", true);
      // Here we update the task which has the effect of setting the state to receiving
      T("command", "update");
      await updateTask_async(task)
      let msgs = T("output.msgs");
      // Extract the prompt
      const msgPrompt = msgs[msgs.length - 2];
      T("state.request.model.prompt", msgPrompt.text)
      const subTask = await SubTaskLLM_async(wsSendTask, task);
      const lastElement = {
        ...msgs[msgs.length - 1],
      }; // shallow copy
      lastElement.text = subTask.response.text
      // Send to sync latest outputs via Hub, should also unlock
      T("output.msgs", [...msgs.slice(0, -1), lastElement]);
      T("state.last", T("state.current"));
      T("state.current", "input");
      T("unlock", true);
      break;
    default:
      console.log("WARNING unknown state : " + task.state.current);
      return null;
    }

  console.log("Returning from TaskChat_async", task.id);
  T("command", "update");
  return task;
};

export { TaskChat_async };
