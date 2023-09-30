/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import _ from 'lodash';
import { utils } from "#src/utils";

/*
ServiceNodeConfig provides read/write access to configuration data, TaskNodeConfigs registers callbacks with ServiceNodeConfig and maintains shared.XXXConfigTree which is synchronised by TaskCEPShared and used by TaskSystemMenu, TaskNodeConfigEditor and TaskChat (when configured with this).
*/

// eslint-disable-next-line no-unused-vars
const TaskNodeConfigEditor_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  //console.log("TaskNodeConfigEditor_async services", services);
  const services = T("services");
  const configFunctions = services["config"].module;
  //console.log("TaskNodeConfigEditor_async configFunctions", configFunctions);

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

  async function parentDiff_async(targetStore, task) {
    const requestedTaskParent = await configFunctions.read_async(services["config"], targetStore, task?.meta?.parentId);
    let diff = {};
    if (requestedTaskParent) {
      diff = keepSameProperties(requestedTaskParent, task);
    }
    return diff
  }

  const targetStore = T("config.local.targetStore");
  
  switch (T("state.current")) {
    case "start": {
      break;
    }
    case "loaded": {
      const action = T("request.action")
      const actionId = T("request.actionId");
      const actionTask = T("request.actionTask");
      utils.logTask("action:", action, "id:", actionId);
      if (action) {
        switch (action) {
          case "create": {
            await configFunctions.create_async(services["config"], targetStore, actionTask);
            break;
          }
          case "read":{
            const [requestedTask, diff] = await Promise.all([
              configFunctions.read_async(services["config"], targetStore, actionId),
              parentDiff_async(targetStore, await configFunctions.read_async(services["config"], targetStore, actionId))
            ]);            
            T("response.task", requestedTask);
            T("response.taskDiff", diff);
            break;
          }
          case "update": {
            await configFunctions.update_async(services["config"], targetStore, actionTask);
            const updatedTask = await configFunctions.read_async(services["config"], targetStore, actionId);
            T("response.task", updatedTask);
            const diff = await parentDiff_async(targetStore, updatedTask);
            T("response.taskDiff", diff);
            break;
          }
          case "delete": {
            await configFunctions.delete_async(services["config"], targetStore, actionId);
            break;
          }
          case "insert": {
            // Create configFunctions.create_async
            await configFunctions.insert_async(services["config"], targetStore, actionId, T("request.newTaskLabel"));
            break;
          }
          case "move": {
            await configFunctions.move_async(services["config"], targetStore, actionId, T("request.destinationId"));
            break;
          }
          case "paste": {
            await configFunctions.paste_async(services["config"], targetStore, T("request.actionId"), T("request.newTaskLabel"), T("request.destinationId"));
            break;
          }
          default:
            throw new Error("unknown action:" + action);
        }
        const taskUpdate = {
          "state.current": "actionDone",
          "command": "update",
          "commandDescription": "Transition to state actionDone",
        };
        T(taskUpdate);
        //utils.logTask("T:", T(), "taskUpdate:", taskUpdate);
      }
    }
    break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskNodeConfigEditor_async };
