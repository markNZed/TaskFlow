/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { interpret } from 'xstate';

export function initiateFsm(T, fsmHolder, actions = {}, guards = {}, singleStep = false) {

  let fsm = fsmHolder.fsm;
  let machine = fsmHolder.machine;

  if (Object.keys(fsm).length === 0) {
    // Automatically create missing guards (otherwise we get errors for guards running on other processors)
    // Should move into a utility function
    const stateNodes = Object.keys(machine.states);
    const allGuards = stateNodes.reduce((acc, stateName) => {
      const stateConfig = machine.states[stateName];
      if (stateConfig.on) {
        for (const eventName in stateConfig.on) {
          const transitions = Array.isArray(stateConfig.on[eventName])
            ? stateConfig.on[eventName]
            : [stateConfig.on[eventName]];
          for (const transition of transitions) {
            if (transition.cond) {
              const guardName = (typeof transition.cond === 'object') ? transition.cond.name : transition.cond;
              acc[guardName] = guards[guardName] || (() => false);
            }
          }
        }
      }
      return acc;
    }, {});
    const extendedMachine = machine.withConfig({ actions, guards: allGuards });
    fsm = interpret(extendedMachine)
      .onEvent((event) => {
        console.log('Event sent:', event.type);
      })
      .onTransition((state) => {
        console.log("FSM transition", state.value, "scheduled actions:", state.actions);
      });
    fsmHolder.send = fsm.send; // So we can use send from within actions
    // fsm.start(T("state.current")); // Does not pick up the entry action
    fsm.start();
    fsmHolder.fsm = fsm;
  } else {
    const fsmState = fsm.getSnapshot().value;
    if (fsmState && fsmState !== T("state.current")) {
      fsm.send("GOTO" + T("state.current"));
    }
    fsmHolder.send = fsm.send;
  }

  if (singleStep) {
    fsm.stop();
  }

  // waitFor is a one-time operation that resolves when a specific condition is met.
  /*
  const doneState = await waitFor(fsm, (state) =>
    state.matches("done"),
  );
  */

}