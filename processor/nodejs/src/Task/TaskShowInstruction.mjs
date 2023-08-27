/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { initiateFsm } from "./fsm.mjs";

const TaskShowInstruction_async = async function (wsSendTask, task, fsmHolder) {

  const T = utils.createTaskValueGetter(task);

  const actions = {
    nodejsStart: () => {
      T("output.instruction", T("config.local.instruction"));
      fsmHolder.send('GOTOdisplayInstruction');
    },
  };

  initiateFsm(T, fsmHolder, actions);

  const fsmState = fsmHolder.fsm.getSnapshot().value;
  if (fsmState && fsmState !== T("state.current")) {
    console.log("Updating state from", T("state.current"), "to", fsmState);
    T("state.last", T("state.current"));
    T("state.current", fsmState);
    T("command", "update");
  }

  // This task can be used as an errorTask so an error here risks to create a loop
  // There is an errorRate limit on the hub to catch this (but it will crash the hub)

  return task;
};

export { TaskShowInstruction_async };
