/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// eslint-disable-next-line no-unused-vars
const TaskChat_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {
  // If we set the command here then we can't override it from CEP
  //T("command", "nop");
  //utils.logTask(task, "TaskChat", task)
  return T();
};

export { TaskChat_async };
