/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { buildTree_async, taskCreate_async, taskMove_async, taskCopy_async, taskRead_async, taskUpdate_async, taskDelete_async, getAllChildrenOfNode, deleteBranch } from "./TaskSystemConfigTasks/configTasks.mjs";
import _ from 'lodash';
import { utils } from "../utils.mjs";
import memoize from 'memoizee';

// We have cacheStore_async provided by storage.mjs but experimenting with memoize
// Can invalidate the memoize cache by updating configTreeUpdateAt
// eslint-disable-next-line no-unused-vars
const m_buildTree_async = memoize(async (configTreeUpdateAt) => {
  return buildTree_async();
}, { promise: true });

let configTree;
let nodesById;
let configTreeUpdateAt = Date();

// eslint-disable-next-line no-unused-vars
const TaskSystemConfigTasks_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  if (T("processor.commandArgs.sync")) {utils.logTask(T(), "Ignore sync operations")}
  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  // eslint-disable-next-line no-unused-vars
  function removeSameProperties(objA, objB) {
    if ((!_.isObject(objA) && _.isObject(objB)) || 
        (_.isObject(objA) && !_.isObject(objB))
    ) {
      return;
    }
    for (const key in objB) {
      if ((!_.isObject(objA[key]) && _.isObject(objB[key])) ||
          (_.isObject(objA[key]) && !_.isObject(objB[key]))
      ) {
        // Do nothing
      } else if (_.isEqual(objA[key], objB[key])) {
        // If the property in objB is the same as that in objA, delete it
        delete objB[key];
      } else if (_.isObject(objB[key]) && _.isObject(objA[key])) {
        // If the property is another object, dive deeper
        removeSameProperties(objA[key], objB[key]);
        // If after removing properties recursively, an object becomes empty, remove it too
        if (_.isEmpty(objB[key])) {
          delete objB[key];
        }
      }
    }
  }

  function keepSameProperties(objA, objB) {
    // If both objects, proceed to compare their properties
    if (_.isObject(objA) && _.isObject(objB) && !Array.isArray(objA) && !Array.isArray(objB)) {
      const newObjB = {};
      for (const key in objB) {
        // eslint-disable-next-line no-prototype-builtins
        if (objA.hasOwnProperty(key) && _.isEqual(objA[key], objB[key])) { 
          // Check if the key exists in objA and the values are equal
          newObjB[key] = objB[key];
        // eslint-disable-next-line no-prototype-builtins
        } else if (objA.hasOwnProperty(key) && _.isObject(objA[key]) && _.isObject(objB[key])) {
          // If both are objects, go deeper
          const subObj = keepSameProperties(objA[key], objB[key]);
          if (!_.isEmpty(subObj)) {
            newObjB[key] = subObj;
          }
        }
      }
      return newObjB;
    }
    // If both are arrays, compare their elements
    if (Array.isArray(objA) && Array.isArray(objB)) {
      return objB.filter((item, index) =>
        index < objA.length ? _.isEqual(objA[index], item) : false
      );
    }
    // If one is an object and the other is an array, or vice versa
    return Array.isArray(objA) || Array.isArray(objB) ? [] : {};
  }

  function createEntryForNullValues(oldConfigTree, configTree) {
    // Loop over each key in oldConfigTree
    for (const key in oldConfigTree) {
      const value = oldConfigTree[key];
      
      // If the value is an object, recursively call the function to handle nested objects
      if (value !== null && typeof value === 'object') {
        // Ensure the key exists in configTree
        configTree[key] = configTree[key] || {};
        createEntryForNullValues(value, configTree[key]);
      }
      // If the value is null, create that entry in configTree
      else if (value === null) {
        configTree[key] = null;
      }
    }
  }  
  
  switch (T("state.current")) {
    case "start": {
      [nodesById, configTree] = await m_buildTree_async(configTreeUpdateAt);
      T("shared.configTree", configTree);
      T("state.current", "loaded");
      T("command", "update");
      break;
    }
    case "loaded": {
      const action = T("request.action")
      const actionId = T("request.actionId");
      let done = false;
      let rebuildTree = false;
      console.log("action:", action, "id:", actionId);
      if (action === "read") {
        // Could us promise.all to fetch in parallel
        const requestedTask = await taskRead_async(actionId);
        const requestedTaskParent = await taskRead_async(requestedTask?.meta?.parentId);
        console.log("requestedTaskParent: ", requestedTaskParent);
        let diff = JSON.parse(JSON.stringify(requestedTask));
        if (requestedTaskParent) {
          diff = keepSameProperties(requestedTaskParent, diff);
        }
        T("response.task", requestedTask);
        T("response.taskDiff", diff);
        done = true;
      } else if (action === "move") {
        const requestedTask = await taskRead_async(actionId);
        await taskMove_async(requestedTask, T("request.destinationId"));
        // How to clean up the old branch in configTree when we rebuild it
        // If we set values to null in config they will be lost in rebuild
        // task.reset.shared.configTree = true
        // This would not merge but just use the new value
        // Another option is to set it to {} at some point
        // could return the new configTree in response but that will not update shared
        // could take updated values for shared from task.response.shared...
        // The processor can in theory see what is deleted and send this ?
        // task.processor.delete
        configTree = deleteBranch(actionId, configTree);
        const oldConfigTree = utils.deepClone(configTree);
        configTreeUpdateAt = Date();
        [nodesById, configTree] = await m_buildTree_async(configTreeUpdateAt);
        // This will delete the old entries in configTree
        createEntryForNullValues(oldConfigTree, configTree)
        done = true;
      } else if (action === "update") {
        await taskUpdate_async(T("request.actionTask"));
        rebuildTree = true;
        done = true;
      } else if (action === "delete") {
        // Find all the tasks in the branch
        const children = getAllChildrenOfNode(actionId, nodesById);
        console.log("children", children.length);
        await taskDelete_async(actionId);
        configTree = deleteBranch(actionId, configTree);
        delete nodesById[actionId];
        for (const child of children) {
          if (child === null) {
            continue;
          }
          //console.log("delete child ", child.key);
          await taskDelete_async(child.key);
          delete nodesById[child.key];
        }
        // We do not rebuild the tree because we hav set the child to null annd this needs to be sent
        // The rebuilt tree will not have the child so it would not be deleted
        done = true;
      } else if (action === "create") {
        if (T("request.copyTaskId")) {
          await taskCopy_async(T("request.copyTaskId"), T("request.newTaskName"), actionId);
          rebuildTree = true;
          done = true;
        } else {
          const newTask = await taskRead_async(actionId);
          const childrenCount = newTask.meta.childrenId ? newTask.meta.childrenId.length : 0;
          const postfix = "new" + childrenCount;
          newTask.meta = newTask.meta || {};
          newTask.meta.childrenId = [];
          newTask.meta.parentId = newTask.id;
          newTask.id += "." + postfix;
          newTask.parentName = newTask.name;
          newTask.name += postfix;
          newTask.config = newTask.config || {};
          newTask.config.label = newTask.config.label || "";
          newTask.config.label += " " + postfix;
          await taskCreate_async(newTask);
          const parentTask = await taskRead_async(actionId);
          parentTask.meta.childrenId = parentTask.meta.childrenId || [];
          parentTask.meta.childrenId.push(newTask.id);
          await taskUpdate_async(parentTask);
          console.log("create ", newTask.id);
          rebuildTree = true;
          done = true;
        }
      }
      if (action) {
        if (done) {
          if (rebuildTree) {
            configTreeUpdateAt = Date();
            [nodesById, configTree] = await m_buildTree_async(configTreeUpdateAt);
          }
          //console.log("nodesById", nodesById[actionId]);
          T({
            "shared.configTree": configTree,
            "state.current": "actionDone",
            "command": "update",
          });
        } else {
          // Should deal with errors etc here
          T("state.current", "actionDone");
          T("command", "update");
        }
      }
    }
    break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemConfigTasks_async };
