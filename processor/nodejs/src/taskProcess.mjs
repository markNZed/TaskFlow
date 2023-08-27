/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { taskFunctions } from "./Task/taskFunctions.mjs";
import { utils } from "./utils.mjs";
import { xutils } from './shared/fsm/xutils.mjs';
import { createMachine } from 'xstate';
import { activeTaskFsm } from "./storage.mjs";

const loadFsmModule_async = async (task) => {
  let importPath;
  let name;
  if (task?.fsm) {
    console.log("loadFsmModule_async returning task.fsm");
    return task.fsm;
  } else if (task?.config?.fsm?.name) {
    importPath = `${task.type}/${task.config.fsm.name}.mjs`;
    name = task.config.fsm.name;
    console.log("loadFsmModule_async task.config.fsm.name", task.config.fsm.name);
  } else if (task.type) {
    importPath = `${task.type}/default.mjs`;
    name = 'default';
    console.log("loadFsmModule_async default");
  } else {
    console.log("No FSM");
    return null;
  }
  try {
    const module = await import('./shared/fsm/' + importPath);
    let fsmConfig = module.getFsm(task);
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
      console.log(`Failed to load FSM at ${'./shared/fsm/' + importPath}`);
    } else {
      console.error(`Failed to load FSM at ${'./shared/fsm/' + importPath}`, error);
      throw error;
    }
  }
};

export async function taskProcess_async(wsSendTask, task) {
    let updatedTask = {};
    if (taskFunctions && taskFunctions[(`${task.type}_async`)]) {
      try {
        let fsmHolder = {
          fsm: {}, 
          machine: null, 
          send: () => {console.error('Send function should be replaced.');}
        };
        if (activeTaskFsm.has(task.instanceId)) {
          fsmHolder["fsm"] = activeTaskFsm.get(task.instanceId);
        } else {
          const fsmConfig = await loadFsmModule_async(task);
          if (fsmConfig && task.config?.fsm?.useMachine) {
            //console.log("Before creating machine", fsmConfig);
            fsmHolder.machine = createMachine(fsmConfig);
          }
        }
        utils.logTask(task, `Processing ${task.type} in state ${task?.state?.current}`);
        updatedTask = await taskFunctions[`${task.type}_async`](wsSendTask, task, fsmHolder);
        if (fsmHolder.fsm) {
          console.log("Updating activeTaskFsm");
          activeTaskFsm.set(task.instanceId, fsmHolder.fsm);
        } else {
          console.log("No activeTaskFsm");
        }
        utils.logTask(task, `Finished ${task.type} in state ${task?.state?.current}`);
      } catch (e) {
        console.error(e);
        updatedTask = task;
        // Strictly we should not be updating the task object in the processor
        // Could set updatedTask.processor.command = "error" ?
        updatedTask.error = {message: e.message};
        updatedTask.command = "update";
        updatedTask.commandArgs = {lockBypass: true};
        if (updatedTask.type === "TaskShowInstruction") {
          throw e; // To avoid cycles
        }
      }
      // Returning null is  away of doing nothing
      if (updatedTask !== null) {
        if (updatedTask.error) {
          console.error("Task error ", updatedTask.error)
          updatedTask["command"] = "update";
          updatedTask["commandArgs"] = {lockBypass: true};
        }
        if (updatedTask?.command === "start") {
          // This is not working/used yet
          throw new Error("start not implemented yet");
          /*
          const task = {
            user: {id: updatedtask.user.id},
            startId: updatedTask.commandArgs.id,
            hub: {},
            command: "start",
          }
          wsSendTask(task);
          */
        } else if (updatedTask?.command === "update") {
          console.log("taskProcess_async sending");
          try {
            wsSendTask(updatedTask);
          } catch (error) {
            console.error(`Command ${updatedTask.command} failed to fetch ${error}`);
          }
        } else {
          console.log("taskProcess_async nothing to do");
        }
      } else {
        console.log("taskProcess_async null " + task.id);
      }
    } else {
      console.log("NodeJS Task Processor unknown component " + task.type);
      //console.log("taskFunctions", taskFunctions);
      updatedTask = task;
    }

}