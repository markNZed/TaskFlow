/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { initiateFsm, updateStates, updateEvent_async } from "#src/taskFSM";
import { utils } from "#src/utils";

const TaskShowInstruction_async = async function (wsSendTask, T, FSMHolder) {

  console.log("TaskShowInstruction_async", utils.js(T("node.commandArgs")));

  // Don't ignore sync operations as this is how we can receive events
  // We can't accept all syncs as it will restart the FSM each time
  if ( T("node.commandArgs.sync") ) {
    let allowSync = false
    if ( T("node.commandArgs.fsmEvent") || T("node.commandArgs.cronEvent") ) {
      console.log("TaskShowInstruction_async allow sync");
      allowSync = true;
    }
    if (!allowSync) return null; // Ignore sync operations
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function filling() {
    await delay(10000);
    console.log("Done filling");
    // Because this is delayed we need to send events by update
    updateEvent_async(wsSendTask, T, 'GOTOfilled');
  }

  // actions are intended to be "fire and forget"
  const actions = {
    rxjs_processor_consumer_start: () => {
      T("output.instruction", T("config.local.instruction"));
      FSMHolder.send('GOTOdisplayInstruction');
    },
    rxjs_processor_consumer_fill: () => {
      // Process the questionnaire
      // This can't be async and we can't wait on it
      filling();
      FSMHolder.send('GOTOwaitingForFill');
    }
  };

  // Cron job will cause syncEvents to be set
  if (T("node.commandArgs.cronEvent") && utils.checkSyncEvents(T(), "request.increment")) {
    console.log("TaskShowInstruction_async cron job request.increment");
    if (!T("output.count")) T("output.count", 0);
    T("output.count", T("output.count") + 1);
    T("command", "update");
  }

  const guards = {};
  const singleStep = true; // So we can wait in waitingForFill until GOTOfilled

  // If the FSM is not sngelStep we should sync the state changes ?

  initiateFsm(T, FSMHolder, actions, guards, singleStep);

  // Transfer state of fsm to task.state
  updateStates(T, FSMHolder);

  // To wait on an action we could do it here, better to use a dedicated state + updateEvent_async

  // This task can be used as an errorTask so an error here risks to create a loop
  // There is an errorRate limit on the Hub to catch this (but it will crash the Hub)

  return T();
};

export { TaskShowInstruction_async };
