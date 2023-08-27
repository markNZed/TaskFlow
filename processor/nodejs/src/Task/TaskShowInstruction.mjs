/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { initiateFsm, updateStates } from "./fsm.mjs";

const TaskShowInstruction_async = async function (wsSendTask, task, fsmHolder) {

  const T = utils.createTaskValueGetter(task);

  const actions = {
    nodejs_start: () => {
      T("output.instruction", T("config.local.instruction"));
      fsmHolder.send('GOTOdisplayInstruction');
    },
  };

  initiateFsm(T, fsmHolder, actions);

  // Transfer state of fsm to task.state
  updateStates(T, fsmHolder);

  // This task can be used as an errorTask so an error here risks to create a loop
  // There is an errorRate limit on the hub to catch this (but it will crash the hub)

  return task;
};

export { TaskShowInstruction_async };
