/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";

const TaskShowInstruction_async = async function (wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);
  
  switch (task.state.current) {
    case "start":
      T("output.instruction", T("config.local.instruction"));
      T("state.last", T("state.current"));
      T("state.current", "displayInstruction");
      T("command", "update");
      break;
    case "displayInstruction":
      console.log(`${task.type} does nothing in state ${task.state.current}`);
      return null
    default:
      console.log("ERROR unknown state : " + task.state.current);
  }

  // This task can be used as an errorTask so an error here risks to 
  // create a loop ?

  console.log(`Returning from ${task.type} task.id`);
  return task;
};

export { TaskShowInstruction_async };
