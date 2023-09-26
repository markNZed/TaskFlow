/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";

// eslint-disable-next-line no-unused-vars
const TaskChat_async = async function (wsSendTask, T, fsmHolder, CEPMatchMap) {

  //console.log("TaskChat_async services", services);

  function arraysEqualIgnoreOrder(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    for (let i = 0; i < sortedA.length; i++) {
      if (sortedA[i] !== sortedB[i]) {
        return false;
      }
    }
    return true;
  }

  switch (T("state.current")) {
    case "start": {
      // Define which states this processor supports
      // Could create a config option for this too but having it in the state machine seems nicer
      // Still want to be able to disable this e.g. to run CEP on any state
      if (T("config.local.statesSupported")) {
        const statesSupported = T("config.local.statesSupported"); ["configFunctionRequest"];
        if (!arraysEqualIgnoreOrder(T("processor.statesSupported"), statesSupported)) {
          // Experiment with this after we have the functions working
          T("processor.statesSupported", statesSupported);
          T("command", "update");
          utils.logTask(T(), "statesSupported:", statesSupported);
        }
      }
      break;
    }
    case "configFunctionRequest": {
      const action = T("request.action")
      const actionId = T("request.actionId");
      const targetConfig = T("request.actionTargetConfig") || "tasks";
      const actionObject = T("request.actionObject");
      const actionPath = T("request.actionPath");
      const actionValue = T("request.actionValue");
      utils.logTask(T(), "action:", action, "id:", actionId, T("request"));
      const systemConfig = T(`services.config.module`);
      if (action) {
        try {
          switch (action) {
            case "create": {
              await systemConfig.create_async(targetConfig, actionObject);
              break;
            }
            case "read":{
              const requestedTask = systemConfig.read_async(targetConfig, actionId)
              T("response.functionResult", requestedTask);
              break;
            }
            case "update": {
              const updatedTask = await systemConfig.update_async(targetConfig, actionObject);
              T("response.functionResult", updatedTask);
              break;
            }
            case "update_value": {
              const updatedKey = await systemConfig.update_value_async(targetConfig, actionId, actionPath, actionValue);
              T("response.functionResult", updatedKey);
              break;
            }
            case "delete": {
              await systemConfig.delete_async(targetConfig, actionId);
              break;
            }
            case "insert": {
              // Create systemConfig.create_async
              await systemConfig.insert_async(targetConfig, actionId, T("request.newObjectLabel"));
              break;
            }
            case "move": {
              await systemConfig.move_async(targetConfig, actionId, T("request.destinationId"));
              break;
            }
            case "paste": {
              await systemConfig.paste_async(targetConfig, T("request.actionId"), T("request.newObjectLabel"), T("request.destinationId"));
              break;
            }
            case "get_task_value": {
              const requestedTask = await systemConfig.read_async(targetConfig, actionId);
              const RT = utils.createTaskValueGetter(requestedTask);
              const value = RT(actionPath);
              T("response.functionResult", {[actionPath]: value});
              break;
            }
            default:
              throw new Error("unknown action:" + action);
          }
          const taskUpdate = {
            "state.current": "configFunctionResponse",
            "commandArgs": {lockBypass: true},
            "command": "update",
          };
          T(taskUpdate);
        } catch (error) {
          utils.logTask(T(), "ERROR:", error);
          const taskUpdate = {
            "response.functionResult": error.message,
            "state.current": "configFunctionResponse",
            "commandArgs": {lockBypass: true},
            "command": "update",
          };
          T(taskUpdate);
        }
        utils.logTask(T(), "response.functionResult", T("response.functionResult"));
      }
      break
    }
    default:
      utils.logTask(T(), "ERROR unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskChat_async };
