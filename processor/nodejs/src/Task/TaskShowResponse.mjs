/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";

const TaskShowResponse_async = async function (wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(
    "TaskShowResponse name " + T("name") + " state " + T("state.current")
  );

  if (T("state.current") === undefined) {
    console.log("TaskShowResponse state.current is undefined");
    return null
  }

  // Ensure we do not overwrite the deltaState on the React Task Processor
  T("response.text", T("config.response"));
  T("response.updated", true);
  console.log("Returning from TaskShowResponse", task.id);
  return task;
};

export { TaskShowResponse_async };
