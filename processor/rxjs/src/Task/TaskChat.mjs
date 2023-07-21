/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";

const TaskChat_async = async function (taskName, wsSendTask, task, CEPFuncs) {
  const T = utils.createTaskValueGetter(task);

  console.log(`${taskName} in state ${task?.state?.current}`);

  // If we set the command here then we can't override it from CEP
  //T("command", "nop");
  //console.log("TaskChat", task)
  return task;
};

export { TaskChat_async };
