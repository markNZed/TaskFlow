/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { createMachine, interpret } from 'xstate';
import { utils } from "./utils.mjs";
import { xutils } from './shared/FSM/xutils.mjs';
import { commandUpdate_async } from "#src/commandUpdate";
import { NODE } from "#root/config";

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
      //utils.logTask(task, "Before creating machine", fsmConfig);
      FSMHolder.machine = createMachine(fsmConfig);
    }
  }
  return FSMHolder;
}

const loadFSMModule_async = async (task) => {
  let importPath;
  let name;
  if (task?.fsm) {
    //utils.logTask(task, "loadFSMModule_async returning task.fsm");
    return task.fsm;
  } else if (task?.config?.fsm?.name) {
    importPath = `${task.type}/${task.config.fsm.name}.mjs`;
    name = task.config.fsm.name;
    utils.logTask(task, "loadFSMModule_async name", task.config.fsm.name);
  } else if (task.type) {
    importPath = `${task.type}/default.mjs`;
    name = 'default';
    utils.logTask(task, `loadFSMModule_async ${task.type}/default.mjs`);
  } else {
    utils.logTask(task, "No FSM");
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
      utils.logTask(task, `No FSM at ${'./shared/FSM/' + importPath}`);
    } else {
      console.error(`Failed to load FSM at ${'./shared/FSM/' + importPath}`, error);
      throw error;
    }
  }
}

export function updateStates(T, FSMHolder) {
  const fsmState = FSMHolder.fsm.getSnapshot().value;
  utils.logTask(T(), `updateStates ${T("state.current")} ${fsmState}`);
  const externalFSMEvent = T("node.commandArgs.fsmEvent");
  const goto = "GOTO" + fsmState;
  utils.logTask(T(), `Check externalFSMEvent ${externalFSMEvent} goto ${goto} sourceNodeId ${T("node.sourceNodeId")} NODE.id ${NODE.id}`);
  const current = T("state.current");
  if (fsmState && fsmState !== current) {
    T("state.last", T("state.current"));
    T("state.current", fsmState);
    if (externalFSMEvent ===  goto) {
      utils.logTask(T(), "Not updating state because set by external FSMEvent");
      // How do we update the state here without sending a global update?
      // Only need to do this if there has been a change to task beyond the state ?
    } else {
      T("command", "update");
      T("commandDescription", `updateStates from ${current} to ${fsmState}`);  
    }
  }
}

export async function updateEvent_async(wsSendTask, T, fsmEvent) {
  let syncUpdateTask = {
    command: "update",
    commandArgs: {
      sync: true,
      instanceId: T("instanceId"),
      fsmEvent: fsmEvent, 
    },
    commandDescription: `Sending event`,
  };
  commandUpdate_async(wsSendTask, syncUpdateTask);
}

export function initiateFsm(T, FSMHolder, actions = {}, guards = {}, singleStep = true) {

  let fsm = FSMHolder.fsm;
  let machine = FSMHolder.machine;

  if (Object.keys(fsm).length === 0) {
    // Automatically create missing guards (otherwise we get errors for guards running on other nodes)
    // Should move into a utility function
    const stateNodes = Object.keys(machine.states);
    const allGuards = stateNodes.reduce((acc, stateName) => {
      const stateConfig = machine.states[stateName];
      if (stateConfig.on) {
        for (const fsmEvent in stateConfig.on) {
          const transitions = Array.isArray(stateConfig.on[fsmEvent])
            ? stateConfig.on[fsmEvent]
            : [stateConfig.on[fsmEvent]];
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
    machine.config["initial"] = machine["initial"] || T("state.current");
    const fsmEvent = T("node.commandArgs.fsmEvent");
    if (fsmEvent && fsmEvent.startsWith("GOTO")) {
      const initial = fsmEvent.substring(4);
      machine.config["initial"] = initial;
      T("node.commandArgs.fsmEvent", null);
      utils.logTask(T(), "Initialize FSM with fsmEvent GOTO " + initial);
    }
    utils.logTask(T(), "Forced initial state to " + machine["initial"]);
    const extendedMachine = machine.withConfig({ actions, guards: allGuards });
    fsm = interpret(extendedMachine)
      .onEvent((event) => {
        utils.logTask(T(), 'Event sent:', event.type);
      })
      .onTransition((state) => {
        utils.logTask(T(), "FSM transition", state.value, "scheduled actions:", state.actions);
        if (singleStep && state.value !== T("state.current")) {
          fsm.stop();
        }
      });
    FSMHolder.send = fsm.send; // So we can use send from within actions
    // fsm.start(T("state.current")); // Does not pick up the entry action
    // This means the FSM will start in the start state and re-execute entry actions there?
    fsm.start();
    FSMHolder.fsm = fsm;
    // Check if we have a pending event
    if (T("node.commandArgs.fsmEvent")) {
      utils.logTask(T(), "Pending event", T("node.commandArgs.fsmEvent"));
      fsm.send(T("node.commandArgs.fsmEvent"));
    }
  } else {
    // fsm is already running
    const fsmState = fsm.getSnapshot().value;
    if (fsmState && fsmState !== T("state.current")) {
      fsm.send("GOTO" + T("state.current"));
    }
    FSMHolder.send = fsm.send;
  }

  // waitFor is a one-time operation that resolves when a specific condition is met.
  /*
  const doneState = await waitFor(fsm, (state) =>
    state.matches("done"),
  );
  */

}