/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { createMachine } from 'xstate';

/*
https://xstate.js.org/docs/guides/start.html

xstate@beta - not ready yet 
Simplified terminology. Concepts shouldn’t have multiple names, so we have simplified terms wherever possible. The basic unit of abstraction in XState v5 beta is the actor, and we’ve removed some of the more confusing terms, such as “service” and “interpreter,” “transient transitions” to “eventless transitions,” “cond” to “guard", “internal: false” to “reenter: true,” and more.
Reduced API surface area. Some of the new features, such as input made existing features redundant, such as machine.withContext(...). We’ve also removed redundant functionality, such as actor.onTransition(...), in favor of actor.subscribe(...). Read about all the breaking changes.

This object has 5 optional properties:
    actions - the mapping of action names to their implementation
    delays - the mapping of delay names to their implementation
    guards - the mapping of transition guard (cond) names to their implementation
    services - the mapping of invoked service (src) names to their implementation
    activities (deprecated) - the mapping of activity names to their implementation

A State object instance is JSON-serializable and has the following properties:
    value - the current state value (e.g., {red: 'walk'})
    context - the current context of this state
    event - the event object that triggered the transition to this state
    actions - an array of actions to be executed
    activities - a mapping of activities to true if the activity started, or false if stopped.
    history - the previous State instance
    meta - any static meta data defined on the meta property of the state node
    done - whether the state indicates a final state

State methods:
  state.matches(parentStateValue)
  state.nextEvents
  state.changed
  state.done
  state.toStrings()
  state.children
  state.hasTag(tag)
  state.can(event)

A State object can be persisted by serializing it to a string JSON format.
  So we could use this for the task.state ?
  State can be restored using the static State.create(...) method:
  const service = interpret(myMachine).start(previousState);

An event is an object with a type property, signifying what type of event it is:
const timerEvent = {
  type: 'TIMER' // the convention is to use CONST_CASE for event names
};
// equivalent to { type: 'TIMER' }
const timerEvent = 'TIMER';

Many native events, such as DOM events, are compatible and can be used directly with XState, by specifying the event type on the type property

Effects
  Actions - single, discrete effects
  Activities - continuous effects that are disposed when the state they were started in is exited. 
  Activites are deprecated and will be removed in XState version 5. The recommended approach is to invoke an actor instead:

The assign() action is used to update the machine's context. Never mutate the machine's context externally.

An optional interpreter is provided that you can use to run your statecharts. The interpreter handles:
    State transitions
    Executing actions (side-effects)
    Delayed events with cancellation
    Activities (ongoing actions)
    Invoking/spawning child statechart services
    Support for multiple listeners for state transitions, context changes, events, etc.
    And more!

*/

const fsm = createMachine(
  {
    predictableActionArguments: true, // opt into some fixed behaviors that will be the default in v5
    preserveActionOrder: true, // will be the default in v5
    id: 'toggle',
    initial: 'inactive',
    // Local context for entire machine
    context: {
      elapsed: 0,
    },
    states: {
      inactive: {
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

//https://xstate.js.org/docs/guides/states.html#state-meta-data
console.log("fsm.states.failure.states.timeout.meta.message", fsm.states.failure.states.timeout.meta.message, fsm);

let fsm2;
try { // try block is not needed
  fsm2 = fsm.withConfig({
    actions: {
      alertGreen: (context, event) => {
        console.log('green');
      }
    }
  });

  fsm2 = fsm.withContext({
    // merge with original context
    ...fsm.context,
    elapsed: 1000
  });
} catch (e) {
  console.log(e);
}

export {fsm, fsm2};
//export default fsm;