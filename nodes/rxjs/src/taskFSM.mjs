/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { createMachine, interpret } from 'xstate';
import { utils } from "./utils.mjs";
import { xutils } from './shared/FSM/xutils.mjs';

export const getFSMHolder_async  = async (task, activeFsm) => {
  const FSMHolder = {
    fsm: {}, 
    machine: null, 
    send: () => {console.error('Send function should be replaced.');}
  };
  if (activeFsm) {
    FSMHolder["fsm"] = activeFsm;
  } else {
    const fsmConfig = await loadFSMModule_async(task);
    if (fsmConfig && task.config?.fsm?.useMachine) {
      //console.log("Before creating machine", fsmConfig);
      FSMHolder.machine = createMachine(fsmConfig);
    }
  }
  return FSMHolder;
}

const loadFSMModule_async = async (task) => {
  let importPath;
  let name;
  if (task?.fsm) {
    //console.log("loadFSMModule_async returning task.fsm");
    return task.fsm;
  } else if (task?.config?.fsm?.name) {
    importPath = `${task.type}/${task.config.fsm.name}.mjs`;
    name = task.config.fsm.name;
    console.log("loadFSMModule_async name", task.config.fsm.name);
  } else if (task.type) {
    importPath = `${task.type}/default.mjs`;
    name = 'default';
    console.log(`loadFSMModule_async ${task.type}/default.mjs`);
  } else {
    console.log("No FSM");
    return null;
  }
  try {
    const module = await import('./shared/FSM/' + importPath);
    let fsmConfig = module.getFSM(task);
    const fsmDefaults = {
      predictableActionArguments: true,
      preserveActionOrder: true,
      id: task.id + "-" + name,
      // This is a hack to get around rehydrating. interpeter.start(stateName) ignores entry actions.
      initial: task.state.current || 'init',
    };
    fsmConfig = utils.deepMerge(fsmDefaults, fsmConfig);
    if (task?.config?.fsm?.merge) {
      fsmConfig = utils.deepMerge(fsmConfig, task.config.fsm.merge);
    }
    if (fsmConfig) {
      fsmConfig = xutils.addDefaultEventsBasedOnStates(fsmConfig);
    }
    return fsmConfig;
  } catch (error) {
    if (error.message.includes("Cannot find module")) {
      console.log(`No FSM at ${'./shared/FSM/' + importPath}`);
    } else {
      console.error(`Failed to load FSM at ${'./shared/FSM/' + importPath}`, error);
      throw error;
    }
  }
}

export function updateStates(T, FSMHolder) {
  const fsmState = FSMHolder.fsm.getSnapshot().value;
  if (fsmState && fsmState !== T("state.current")) {
    console.log("updateStates from", T("state.current"), "to", fsmState);
    T("state.last", T("state.current"));
    T("state.current", fsmState);
    T("command", "update");
  }
}

export function initiateFsm(T, FSMHolder, actions = {}, guards = {}, singleStep = false) {

  let fsm = FSMHolder.fsm;
  let machine = FSMHolder.machine;

  if (Object.keys(fsm).length === 0) {
    // Automatically create missing guards (otherwise we get errors for guards running on other nodes)
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
    FSMHolder.send = fsm.send; // So we can use send from within actions
    // fsm.start(T("state.current")); // Does not pick up the entry action
    fsm.start();
    FSMHolder.fsm = fsm;
  } else {
    const fsmState = fsm.getSnapshot().value;
    if (fsmState && fsmState !== T("state.current")) {
      fsm.send("GOTO" + T("state.current"));
    }
    FSMHolder.send = fsm.send;
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