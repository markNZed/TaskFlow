/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { actionThenQuery } from '../xutils.mjs';

export const fsm = {
  predictableActionArguments: true, // opt into some fixed behaviors that will be the default in v5
  preserveActionOrder: true, // will be the default in v5
  id: 'chat',
  initial: 'init',
  on: {
    TIMEOUT: 'fail' // Listen for the 'FAIL' event at the top level
  },
  states: {
    init: {
      on: { START: 'start'},
    },
    // start state is defined in task.config.fsm.merge 
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
  
  
