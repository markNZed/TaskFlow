/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";

const TaskShowResponse_async = async function (taskName, wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(
    "TaskShowResponse name " + T("name") + " state " + T("state.current")
  );

  switch (task.state.current) {
    case undefined:
      console.log("TaskShowResponse state.current is undefined");
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

  console.log("Returning from TaskShowResponse", task.id);
  return task;
};

export { TaskShowResponse_async };
