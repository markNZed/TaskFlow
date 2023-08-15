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
          after: {
            // after 30 second, transition to timeout
            30000: 'failure.timeout'
          },
          // on TOGGLE event go to active state
          on: { TOGGLE: 'active' },
          entry: ['login'],
          exit: ['logout'],
        },
        active: {
          on: { TOGGLE: 'resolve' },
          entry: ['alertHi'],
        },
        resolve: {  
          after: {
            // after 1 second, transition to resolved
            1000: { target: 'resolved' },
          },
        },
        resolved: {
          type: 'final',
        },
        failure: {
          initial: 'rejection',
          states: {
            rejection: {
              meta: {
                message: 'The request failed.'
              },
            },
            timeout: {
              meta: {
                message: 'The request timed out.'
              },
              entry: ['alertMetaMessage'],
            },
          },
          meta: {
            alert: 'Uh oh.'
          },
        },
      },
    },
    {
      actions: {
        /* ... */
        login: (context, event) => {
          console.log('login', context.elapsed, event);
        },
        logout: (context, event) => {
          console.log('logout', context.elapsed, event);
        },
        alertMetaMessage: (context, event) => {
          console.log('alertMetaMessage', context, event);
        },
        alertHi: () => {
          alert("Hi");
        },
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
  
  
