/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/* eslint-plugin-xstate-include */

// State name should represent what can happen (i.e. actions) in that state
// Actions should start with verbs
// Action that runs on entry should have the same name as the state
// There are default events for each state with the same name (and case) as the state that will cause a transition to the new state
// choose: for conditional actions 
// eslint-disable-next-line no-unused-vars
export function getFSM(initialTask) {
  return {
    "states": {
      "start": {
        "entry": ["rxjs_processor_consumer_start", "rxjs_hub_consumer_start", "rxjs_hub_coprocessor_start", "react_start_loading"],
        "always": {
          "target": "displayInstruction",
          "cond": "react_instructionCached"
        }
      },
      "displayInstruction": {
        "entry": ["react_displayInstruction", "rxjs_processor_consumer_fill"],
      },
      "waitingForFill": {
      },
      "filled": {
        "entry": "react_stop_loading",
      },
      "finish": {
        "entry": "react_finish"
      }
    }
  }
}  
