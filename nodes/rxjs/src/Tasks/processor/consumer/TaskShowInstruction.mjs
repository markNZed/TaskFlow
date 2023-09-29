/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { initiateFsm, updateStates } from "#src/taskFSM";

const TaskShowInstruction_async = async function (wsSendTask, T, FSMHolder) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  const actions = {
    nodejs_start: () => {
      T("output.instruction", T("config.local.instruction"));
      FSMHolder.send('GOTOdisplayInstruction');
    },
  };

  initiateFsm(T, FSMHolder, actions);

  // Transfer state of fsm to task.state
  updateStates(T, FSMHolder);

  // This task can be used as an errorTask so an error here risks to create a loop
  // There is an errorRate limit on the hub to catch this (but it will crash the hub)

  return T();
};

export { TaskShowInstruction_async };
