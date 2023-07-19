/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";

const TaskShowInstruction_async = async function (taskName, wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(`${taskName} in state ${task.state.current}`);
  
  switch (task.state.current) {
    case "start":
      T("output.instruction", T("config.local.instruction"));
      T("state.last", T("state.current"));
      T("state.current", "response");
      T("command", "update");
      break;
    case undefined:
    case "response":
      console.log(`${taskName} does nothing in state ${task.state.current}`);
      return null
    default:
      console.log("ERROR unknown state : " + task.state.current);
  }

  // This task can be used as an errorTask so an error here risks to 
  // create a loop ?

  console.log(`Returning from ${taskName} task.id`);
  return task;
};

export { TaskShowInstruction_async };
