/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { createMachine, forwardTo, send, assign } from 'xstate';
import TreeModel from 'tree-model';

export const fsm = createMachine({
  predictableActionArguments: true, // opt into some fixed behaviors that will be the default in v5
  preserveActionOrder: true, // will be the default in v5
  id: 'toggle',
  initial: 'start',
  states: {
    start: {
      on: {
        CHAT_FOUND: {
          target: 'taskChatFound',
          actions: assign({
            familyTreeNode: (context, event) => event.familyTreeNode
          }),
        },
        FAMILY: { actions: forwardTo('checkTaskService') }
      },
      invoke: {
        id: 'checkTaskService',
        src: 'checkTaskService',
      },
    },
    taskChatFound: {
      on: {
        PROMPT: {
          target: 'promptFound',
          actions: assign({
            data: (context, event) => event.data
          }),
        },
      },
      entry: [
        {
          type: 'logMsg',
          message: 'Entering taskChatFound state'
        },
        { 
          type: 'updateTask'
        }
      ],
    },
    promptFound: {
      entry: [
        {
          type: 'logMsg',
          message: 'Found prompt'
        },
        'submitPrompt',
      ],
      on: {
        RESPONSE: {
          target: 'checkResponse',
          actions: assign({
            data: (context, event) => event.data
          }),
        }
      }
    },
    checkResponse: {
      on : {
          PASS: 'pass',
          FAIL: 'fail'
      },
      entry: [
        {
          type: 'logMsg',
          message: 'Checking response'
        },
        'checkResponse',
      ]
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
      console.log(action.message);
    }
  },
  delays: {
    /* ... */
  },
  guards: {
    /* ... */
  },
  services: {
    checkTaskService: (context, event) => (callback, onReceive) => {
      onReceive((event) => {
        //console.log("event", event);
        if (event.type === 'FAMILY') {
          // Perform the check
          const task = context.taskRef.current;
          //console.log("task", task);
          if (task && task.state.familyTree) {
            const root = new TreeModel().parse(task.state.familyTree);
            const chat = root.first(node => node.model.type === "TaskChat");
            //console.log("chat", chat);
            if (chat) {
              // Send an event back to the machine
              callback({type: 'CHAT_FOUND', familyTreeNode: chat});
            }
          }
        }
      })
    },
  },
});
  
  
