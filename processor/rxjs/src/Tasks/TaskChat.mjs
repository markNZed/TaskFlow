/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";

// eslint-disable-next-line no-unused-vars
const TaskChat_async = async function (wsSendTask, T, fsmHolder, CEPFuncs, services) {

  const systemConfig = services["config"].module;

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
      const statesSupported = ["configFunctionRequest"];
      if (!arraysEqualIgnoreOrder(T("processor.statesSupported"), statesSupported)) {
        T("processor.statesSupported", statesSupported);
        T("command", "update");
      }
      break;
    }
    case "configFunctionRequest": {
      const action = T("request.action")
      const actionId = T("request.actionId");
      const targetStore = T("request.actionTargetStore");
      let rebuildTree = true;
      let configTree;
      utils.logTask("action:", action, "id:", actionId);
      if (action) {
        switch (action) {
          case "create": {
            await systemConfig.create_async(targetStore, T("request.actionTask"));
            break;
          }
          case "read":{
            const requestedTask = systemConfig.read_async(targetStore, actionId)
            T("response.task", requestedTask);
            rebuildTree = false;
            break;
          }
          case "update": {
            const updatedTask = await systemConfig.update_async(targetStore, T("request.actionTask"));
            T("response.task", updatedTask);
            break;
          }
          case "delete": {
            await systemConfig.delete_async(targetStore, actionId);
            // Find all the children in the branch
            const children = systemConfig.getAllChildrenOfNode(actionId, configTree);
            for (const child of children) {
              //console.log("delete child ", child.id);
              await systemConfig.delete_async(targetStore, child.id);
            }
            break;
          }
          case "insert": {
            // Create systemConfig.create_async
            await systemConfig.insert_async(targetStore, actionId, T("request.newTaskLabel"));
            break;
          }
          case "move": {
            await systemConfig.move_async(targetStore, actionId, T("request.destinationId"));
            break;
          }
          case "paste": {
            await systemConfig.paste_async(targetStore, T("request.actionId"), T("request.newTaskLabel"), T("request.destinationId"));
            break;
          }
          default:
            throw new Error("unknown action:" + action);
        }
        if (rebuildTree) {
          configTree = await systemConfig.buildTree_async(targetStore);
        }
        const taskUpdate = {
          "shared.configTree": configTree,
          "state.current": "actionDone",
          "command": "update",
        };
        T(taskUpdate);
        //utils.logTask("T:", T(), "taskUpdate:", taskUpdate);
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
