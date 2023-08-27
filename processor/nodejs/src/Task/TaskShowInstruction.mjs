/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { interpret } from 'xstate';
import { utils } from "../utils.mjs";

const TaskShowInstruction_async = async function (wsSendTask, task, machine, fsmHolder) {
  const T = utils.createTaskValueGetter(task);

  let fsm = fsmHolder.fsm;

  if (!fsm) {

    // Send function cannot be set until after we have the interpreter
    // But we need to provide actions to the interpreter
    let fsmSend = () => {
      console.warn('Placeholder send function invoked. This should be replaced.');
    };

    const actions = {
      rehydrate: () => task.state.current === "init" ? fsmSend("start") : fsmSend(task.state.current),
      nodejsStart: () => {
        console.log("nodejsStart");
        T("output.instruction", T("config.local.instruction"));
        fsmSend('displayInstruction'); // will transition to the state "displayInstruction" maybe a better name? goToDisplayInstruction
      },
    };

    const guards = {};

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
        // Handle state changes, call wsSendTask, or other side-effects.
      });
    fsmSend = fsm.send; // So we can use send from within actions
    // fsm.start(task.state.current); // Does not pick up the entry action
    fsm.start();
  } else {
    const fsmState = fsm.getSnapshot().value;
    if (fsmState && fsmState !== task.state.current) {
      fsm.send(task.state.current);
    }
  }

  // waitFor is a one-time operation that resolves when a specific condition is met.
  /*
  const doneState = await waitFor(fsm, (state) =>
    state.matches("done"),
  );
  */

  const fsmState = fsm.getSnapshot().value;
  if (fsmState && fsmState !== task.state.current) {
    //console.log("Updating state from", task.state.current, "to", fsmState);
    T("state.last", T("state.current"));
    T("state.current", fsmState);
    T("command", "update");
  }

  // At the moment we are starting th machine then stopping it which assumes we basically evaluate a state and transition
  // If we run the machine all the time (like in React Processor) then how do we update the state ?
  // Would need to keep a reference to the FSM rather than restarting - could check if the machine is stopped ?
  //   Pass the fsm as paremeter of TaskShowInstruction_async so we either init or continue
  //   Would need to check the task.current.state and inject an event (like we do on React Processor)
  //     Could experiment with this
  //       fsm storage by instance id
  // Stop the interpreter to clean up
  //fsm.stop();

  // This task can be used as an errorTask so an error here risks to create a loop
  // There is an errorRate limit on the hub to catch this (but it will crash the hub)

  return task;
};

export { TaskShowInstruction_async };
