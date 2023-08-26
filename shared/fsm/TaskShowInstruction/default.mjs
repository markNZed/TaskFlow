/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// State name should represent what can happen (i.e. actions) in that state
// Actions should start with verbs
// Action that runs on entry should have the same name as the state
// There are default events for each state with the same name (and case) as the state that will cause a transition to the new state
// choose: for conditional actions 
// eslint-disable-next-line no-unused-vars
export function getFsm(initialTask) {
  return {  
    states: {
      start: {
        always: { target: 'displayInstruction', cond: 'instructionCached' },
      },
      displayInstruction: {
        entry: 'displayInstruction',
        on: { NEW_INSTRUCTION: { actions: 'displayInstruction' } }
      },
      finish: {
        entry: 'finish',
      },
    },
  }
}

