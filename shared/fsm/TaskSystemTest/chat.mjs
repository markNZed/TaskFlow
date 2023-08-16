/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { createMachine } from 'xstate';

export const fsm = createMachine(
    {
      predictableActionArguments: true, // opt into some fixed behaviors that will be the default in v5
      preserveActionOrder: true, // will be the default in v5
      id: 'toggle',
      initial: 'start',
      states: {
        start: {
          // on TOGGLE event go to active state
          on: { TOGGLE: 'userInput' },
          //entry: ['login'],
          //exit: ['logout'],
        },
        userInput: {
          on: { TOGGLE: 'llmResponse' },
          entry: ['alertHi'],
        },
        llmResponse: {  
          after: {
            // after 1 second, transition to resolved
            1000: { target: 'pass' },
          },
        },
        pass: {
          type: 'final',
        }
      },
    },
    {
      actions: {
        /* ... */
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
    },
  );
  
  
