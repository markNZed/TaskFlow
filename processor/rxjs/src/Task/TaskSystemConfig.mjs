/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { buildTree_async, insert_async, move_async, paste_async, read_async, update_async, delete_async, getAllChildrenOfNode } from "./TaskSystemConfig/configTasks.mjs";
import _ from 'lodash';
import { utils } from "../utils.mjs";
import memoize from 'memoizee';

// We have cacheStore_async provided by storage.mjs but experimenting with memoize
// Can invalidate the memoize cache by changing configTreeTimestamp
// eslint-disable-next-line no-unused-vars
const m_buildTree_async = memoize(async (targetStore, configTreeTimestamp) => {
  const result = await buildTree_async(targetStore);
  // To ensure changes to config that do not modify tree structure still set task.meta.modified.shared.configTree
  result["timestamp"] = configTreeTimestamp; 
  return result;
}, { promise: true });

let configTree;
let configTreeTimestamp = Date();

// eslint-disable-next-line no-unused-vars
const TaskSystemConfig_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  if (T("processor.commandArgs.sync")) {utils.logTask(T(), "Ignore sync operations")}
  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  /**
   * Removes properties from objB that have the same values as those in objA.
   * This is a recursive function that also removes properties from nested objects.
   * 
   * @param {Object} objA - The reference object against which objB is compared.
   * @param {Object} objB - The object to be modified by removing properties that are identical to those in objA.
   * 
   * @returns {void} - This function doesn't return anything; it modifies objB in place.
   * 
   * @example
   * const objA = { name: "Alice", age: 30, details: { hobbies: ["reading"] } };
   * const objB = { name: "Alice", age: 40, details: { hobbies: ["reading", "swimming"] } };
   * removeSameProperties(objA, objB);
   * // objB will now be { age: 40, details: { hobbies: ["swimming"] } }
   * 
   * @dependencies
   * This function depends on the lodash library for utility functions like _.isObject, _.isEqual, and _.isEmpty.
   */
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

  /**
   * Creates and returns a new object based on objB that retains only the properties that also exist in objA and have the same values.
   * This is a recursive function that also operates on nested objects and arrays.
   * 
   * @param {Object|Array} objA - The reference object or array against which objB is compared.
   * @param {Object|Array} objB - The object or array from which to keep properties or elements that are identical to those in objA.
   * 
   * @returns {Object|Array} - A new object or array containing only the properties or elements that exist in both objA and objB and have identical values.
   * 
   * @example
   * const objA = { name: "Alice", age: 30, details: { hobbies: ["reading"] } };
   * const objB = { name: "Alice", age: 40, details: { hobbies: ["reading", "swimming"] } };
   * const newObjB = keepSameProperties(objA, objB);
   * // newObjB will now be { name: "Alice", details: { hobbies: ["reading"] } }
   *
   * @dependencies
   * This function depends on the lodash library for utility functions like _.isObject, _.isEqual, and _.isEmpty.
   */
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

  async function parentDiff(targetStore, requestedTask) {
    const requestedTaskParent = await read_async(targetStore, requestedTask?.meta?.parentId);
    let diff = utils.deepClone(requestedTask);
    if (requestedTaskParent) {
      diff = keepSameProperties(requestedTaskParent, diff);
    }
    return diff
  }

  const targetStore = T("config.local.targetStore");
  
  switch (T("state.current")) {
    case "start": {
      configTree = await m_buildTree_async(targetStore, configTreeTimestamp);
      T("shared.configTree", configTree);
      T("state.current", "loaded");
      T("command", "update");
      break;
    }
    case "loaded": {
      const action = T("request.action")
      const actionId = T("request.actionId");
      let rebuildTree = true;
      utils.logTask(T(), "action:", action, "id:", actionId);
      if (action) {
        switch (action) {
          case "read":{
            // Could us promise.all to fetch in parallel
            const requestedTask = await read_async(targetStore, actionId);
            const diff = parentDiff(targetStore, requestedTask);
            T("response.task", requestedTask);
            T("response.taskDiff", diff);
            rebuildTree = false;
            break;
          }
          case "move": {
            await move_async(targetStore, actionId, T("request.destinationId"));
            break;
          }
          case "update": {
            await update_async(targetStore, T("request.actionTask"));
            const diff = parentDiff(targetStore, T("request.actionTask"));
            T("response.taskDiff", diff);
            T("response.task", T("request.actionTask"));
            break;
          }
          case "delete": {
            await delete_async(targetStore, actionId);
            // Find all the tasks in the branch
            const children = getAllChildrenOfNode(actionId, configTree);
            for (const child of children) {
              //console.log("delete child ", child.id);
              await delete_async(targetStore, child.id);
            }
            break;
          }
          case "paste": {
            await paste_async(targetStore, T("request.actionId"), T("request.newTaskLabel"), T("request.destinationId"));
            break;
          }
          case "insert": {
            // Create create_async
            await insert_async(targetStore, actionId, T("request.newTaskLabel"));
            break;
          }
          default:
            throw new Error("unknown action:" + action);
        }
        if (rebuildTree) {
          configTreeTimestamp = Date();
          configTree = await m_buildTree_async(targetStore, configTreeTimestamp);
        }
        T({
          "shared.configTree": configTree,
          "state.current": "actionDone",
          "command": "update",
        });
      }
    }
    break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemConfig_async };
