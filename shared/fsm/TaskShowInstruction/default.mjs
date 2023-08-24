/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// @ts-check

export function getFsm(initialTask) {
  return {
    on: { EXIT: 'exitState' },
    states: {
      start: {
        always: { target: 'response', cond: 'instructionCached' },
        on: { 'STATE_RESPONSE': 'response' },
      },
      response: {
        
        after: {
          0: { actions: 'setInstruction', cond: 'newText' } // Delay of 0ms
        },
        
        /*
        entry: {
          actions: 'setInstruction', cond: 'newText'
        },
        */
        //always: { actions: 'setInstruction', cond: 'newText' },
        on: {
          SET_INSTRUCTION: {
            actions : 'setInstruction',
          }
        },
      },
      exitState: {
        entry: 'exitAction',
      },
    },
  };
};
  
  
