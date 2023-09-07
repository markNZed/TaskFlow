/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { initiateFsm, updateStates } from "../shared/processor/fsm.mjs";

// eslint-disable-next-line no-unused-vars
const TaskShowInstruction_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  const actions = {
    rxjs_start: () => {
      console.log("TaskShowInstruction_async rxjs_start");
    },
  };

  initiateFsm(T, fsmHolder, actions);

  // Transfer state of fsm to task.state
  updateStates(T, fsmHolder);

  // This task can be used as an errorTask so an error here risks to create a loop
  // There is an errorRate limit on the hub to catch this (but it will crash the hub)

  return T();
};

export { TaskShowInstruction_async };
