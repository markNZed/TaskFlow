/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";

const TaskShowResponse_async = async function (taskName, wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(`${taskName} in state ${task.state.current}`);
  
  switch (task.state.current) {
    case undefined:
    case "response":
      console.log(`${taskName} does nothing in state ${task.state.current}`);
      return null
    case "start":
      T("output.response", T("config.response"));
      T("state.last", T("state.current"));
      T("state.current", "response");
      T("command", "update");
      break;
    default:
      console.log("ERROR unknown state : " + task.state.current);
  }

  // This task can be used as an errorTask so an error here risks to 
  // create a loop ?

  console.log("Returning from TaskShowResponse", task.id);
  return task;
};

export { TaskShowResponse_async };
