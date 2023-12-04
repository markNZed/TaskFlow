/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";

// eslint-disable-next-line no-unused-vars
const TaskCEP_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  //if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  // Cron job will cause syncEvents to be set
  if (T("node.commandArgs.cronEvent") && utils.checkSyncEvents(T(), "request.increment")) {
    console.log("TaskShowInstruction_async cron job request.increment");
    if (!T("output.count")) T("output.count", 0);
    T("output.count", T("output.count") + 1);
    T("command", "update");
  }

  // A placeholder to allow for CEP to be installed without a Task Function
  return null;
};

export { TaskCEP_async };
