/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { actionThenQuery } from '../xutils.mjs';

/*
switch (task.state.current) {
      case "start":
        if (task.output.instruction) {
          log("Instruction cached React Task Processor side");
          nextState = "response";
        }
        break;
      case "response":
        if (instructionText !== task.output.instruction) {
          setInstructionText(task.output.instruction);
        }
        break;
      case "exit":
        if (transition()) {
          modifyTask({ "state.done": true });
        }
        break
*/

// We are defining a constant here does it resolve references?

export const fsm = {
  predictableActionArguments: true, // opt into some fixed behaviors that will be the default in v5
  preserveActionOrder: true, // will be the default in v5
  id: 'default',
  initial: 'init', // in theory we don't need this if we use the order of the state declarations
  states: {
    init: {
      on: { START: 'start'},
    },
    states: {
      ...actionThenQuery('start', [], ['findTextarea']),
    },
    ...actionThenQuery('foundTextarea', ['enterPrompt'], ['findPrompt']),
    ...actionThenQuery('foundPrompt', ['submitPrompt'], ['findResponse']),
    foundResponse: {
      entry: 'pass',
      type: 'final', // Will ignore future events e.g. TIMEOUT
    },
    fail: {
      entry: 'fail',
      type: 'final',
    },
  },
};
  
  
