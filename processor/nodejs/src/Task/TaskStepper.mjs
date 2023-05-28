/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";

const TaskStepper_async = async function (wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log("Returning from TaskStepper_async");

  return task;
};

export { TaskStepper_async };
