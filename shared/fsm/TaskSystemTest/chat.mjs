/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { createMachine, forwardTo, send, assign } from 'xstate';

export const fsm = createMachine({
  predictableActionArguments: true, // opt into some fixed behaviors that will be the default in v5
  preserveActionOrder: true, // will be the default in v5
  id: 'toggle',
  initial: 'start',
  states: {
    start: {
      on: {
        TEXTAREA: {
          target: 'textareaFound',
        },
      },
      entry: [
        {
          type: 'logMsg',
          message: 'Entering taskChatFound state'
        },
        { 
          type: 'queryExpect', 
          action: 'findTextarea',
        }
      ],
    },
    textareaFound: {
      on: {
        PROMPT_SEEN: {
          target: 'promptSeen',
          actions: {
            type: 'taskAction',
            action: 'submitPrompt',
          },
        },
      },
      entry: [
        {
          type: 'logMsg',
          message: 'Entering textareaFound state'
        },
        { 
          type: 'taskAction', 
          action: 'enterPrompt',
        },
        { 
          type: 'queryExpect', 
          action: 'findPrompt',
        },
      ],
    },
    promptSeen: {
      entry: [
        {
          type: 'logMsg',
          message: 'Entering promptSeen state'
        },
        { 
          type: 'queryExpect', 
          action: 'findResponse',
        }
      ],
      on: {
        PASS: 'pass',
        FAIL: 'fail',
      }
    },
    pass: {
      entry: [
        {
          type: 'alertMsg',
          message: 'Pass',
        },
      ],
      type: 'final',
    },
    fail: {
      entry: [
        {
          type: 'alertMsg',
          message: 'Fail',
        },
      ],
      type: 'final',
    },
  },
},
{
  actions: {
    alertMsg: (context, event, { action }) => {
      alert(action.message);
    },
    logMsg: (context, event, { action }) => {
      console.log(action.message, context.data, Date());
    }
  },
  delays: {
    /* ... */
  },
  guards: {
    /* ... */
  },
  services: {
    /* ... */
  },
});
  
  
