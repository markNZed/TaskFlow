/* eslint-disable no-prototype-builtins */
import _ from "lodash";
import assert from 'assert';
import { nanoid } from 'nanoid';

// Without this we cannot make partial updates to objects in the Task

const utils = {

  getNestedValue: function (obj, path) {
    if (typeof path !== 'string') {
      console.error('Path must be a string', path);
      throw new Error('Path must be a string');
    }    
    return path.split(".").reduce((prev, curr) => {
      return prev && prev[curr] !== undefined ? prev[curr] : undefined;
    }, obj);
  },

  setNestedValue: function (obj, path, value) {
    const pathArray = path.split(".");
    const lastKey = pathArray.pop();
    const target = pathArray.reduce((prev, curr) => {
      return (prev[curr] = prev[curr] || {});
    }, obj);

    target[lastKey] = value;
  },

  nullNestedValue: function (obj, path) {
    const pathArray = path.split(".");
    const lastKey = pathArray.pop();
    const target = pathArray.reduce((prev, curr) => {
      return (prev[curr] = prev[curr] || {});
    }, obj);
    target[lastKey] = null;
  },

  updateLeafKeys: function(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
          // If the key points to an object and the object is not an array or null,
          // we should recursively go deeper.
          if (!target[key]) {
            target[key] = {}; // Initialize if the key doesn't exist in the target
          }
          utils.updateLeafKeys(target[key], source[key]);
        } else {
          // Leaf node: either a primitive type or an array or null
          target[key] = source[key];
        }
      }
    }
  },

  createTaskValueGetter: function(task) {
    return function (arg1, value) {
      if (arguments.length === 1) {
        if (typeof arg1 === 'string') {
          return utils.getNestedValue(task, arg1);
        } if (typeof arg1 === 'object') {
          // Clear the values that we are going to set
          Object.keys(arg1).forEach((key) => {
            utils.nullNestedValue(task, key);
          });
          utils.setNestedProperties(arg1);
          // Merge values or write over them
          // For example
          //   {"a.b" = {c: "d"}} will set a.b to null then set a.b.c = d
          //   {"a.b.e" = "f"} will set a.b.e to null then set a.b.e = f
          //   The object would then have a.b.c = d and a.b.e = f
          // Use intermediate variable to keep the original task reference
          let mergedTask = utils.deepMerge(task, arg1);
          // Clear the original task
          Object.keys(task).forEach(key => delete task[key]);
          // Populate the original task with the merged values
          Object.keys(mergedTask).forEach(key => {
            task[key] = mergedTask[key];
          });
          //utils.updateLeafKeys(task, arg1);
          return task;
        } else {
          console.error('Invalid argument type', arg1);
          throw new Error('Invalid argument type');
        }
      } else if (arguments.length === 2) {
        let mod = {[arg1]: value}
        // Clear the values that we are going to set
        Object.keys(mod).forEach((key) => {
          utils.nullNestedValue(task, key);
        });
        utils.setNestedProperties(mod);
        // Merge values or write over them
        // Use intermediate variable to keep the original task reference
        let mergedTask= utils.deepMerge(task, mod);
        // Clear the original task
        Object.keys(task).forEach(key => delete task[key]);
        // Populate the original task with the merged values
        Object.keys(mergedTask).forEach(key => {
            task[key] = mergedTask[key];
        });
        //utils.updateLeafKeys(task, mod);
        return task;
        //console.log("createTaskValueGetter set ", arg1, value)
      } else if (!arg1 && !value) {
        return task;
      } else {
        const result = utils.getNestedValue(task, arg1);
        //console.log("createTaskValueGetter get ", arg1, result)
        return result;
      }
    };
  },

  setNestedProperties: function(obj, path, value) {
    // Validate input object
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Input must be a non-null object.');
    }

    // If called with just an object, apply the rules of splitting top-level keys
    if (arguments.length === 1) {
      for (const key in obj) {
        // eslint-disable-next-line no-prototype-builtins
        if (obj.hasOwnProperty(key)) {
          const keys = key.split('.');
          let currentObj = obj;
          for (let i = 0; i < keys.length; i++) {
            const subKey = keys[i];
            if (i === keys.length - 1) {
              currentObj[subKey] = obj[key];
            } else {
              currentObj[subKey] = currentObj[subKey] || {};
              currentObj = currentObj[subKey];
            }
          }
        }
      }
      // Clear the original keys after creating the nested structure
      for (const key in obj) {
        if (key.includes('.')) {
          delete obj[key];
        }
      }
      return obj; // Return the modified original object
    }

    // Validate path
    if (path === '') {
      throw new Error('Invalid empty key provided.');
    }

    const processKey = (obj, key, value) => {
      // Ensure key is a string
      if (typeof key !== 'string') {
        console.error('Key must be a string', key);
        throw new Error('Key must be a string');
      }
      // Check for empty key or key with only dots
      if (!key || key.split('.').every(subKey => subKey === '')) {
        throw new Error('Invalid key provided:' + key);
      }

      if (obj === null) {
        obj = {};
      }

      // Split the key into top-level and remaining parts
      const [head, ...tail] = key.split('.');

      // If the exact key exists at the top level, set it directly
      // eslint-disable-next-line no-prototype-builtins
      if (obj.hasOwnProperty(head)) {
        // This is OK at a leaf i.e., tail.length === 0
        if (typeof obj[head] !== 'object' && tail.length > 0) {
          throw new Error('Cannot set a nested property on a non-object value');
        }
        if (tail.length === 0) {
          obj[head] = value;
        } else {
          if (obj[head] === null) {
            obj[head] = {};  // Replace null with empty object
          }
          processKey(obj[head], tail.join('.'), value);
        }
      } else {
        // If the key does not exist at the top level, create it
        if (tail.length === 0) {
          obj[head] = value;
        } else {
          obj[head] = {};
          processKey(obj[head], tail.join('.'), value);
        }
      }
    };

    processKey(obj, path, value);
    return obj; // Return the modified original object
  },

  deepMergeNode: function(prevState, update, nodeIn) {
    const node = utils.deepClone(nodeIn);
    let result = utils.deepMerge(prevState, update);
    result.node = node;
    return result;
  },

  deepMerge: function(prevState, update, debug = false, depth = 0) {

    if (debug && (depth === 0)) {console.log("deepMerge depth 0:", prevState, update)}

    if (prevState === undefined) {
      return update;
    }

    if (update === undefined) {
      return prevState;
    }

    if (_.isEmpty(update)) {
      return update;
    }

    if (Array.isArray(update)) {
      if (debug) {console.log("deepMerge array", prevState, update)}
      let output = [];
      const maxLength = update.length;
    
      for (let i = 0; i < maxLength; i++) {
        // Null is treated as a placeholder in the case of arrays
        if (!prevState || i >= prevState.length) {
          if (debug) {console.log("deepMerge length", prevState[i])}
          output.push(update[i]);
        } else if (update[i] === null) {
          if (debug) {console.log("deepMerge null", prevState[i])}
          output.push(prevState[i]);
        } else if (typeof update[i] === "object" || Array.isArray(update[i])) {
          const merge = utils.deepMerge(prevState[i], update[i], debug, depth + 1);
          if (debug) {console.log("deepMerge merge", merge)}
          if (merge === null) {
            output.push(prevState[i]);
          } else {
            output.push(merge);
          }
        } else {
          if (debug) {console.log("deepMerge other", update[i])}
          output.push(update[i]);
        }
      }

      // We do not include the longer prevState, so the update can remove items from the end
      //if (prevState.length > update.length) {
      //  output.push(...prevState.slice(update.length));
      //}

      return output;
    }

    if (typeof update === "object") {
      let output = {};
      if (typeof prevState === "object" && prevState !== null) {
        output = utils.deepClone(prevState);
      }
      if (debug) {console.log("output before", utils.deepClone(output))}
      if (debug) {console.log("update before", utils.deepClone(update))}
      for (const key in update) {
        // Null is treated as a deletion in the case of objects
        if (update[key] === null) {
          output[key] = null;
          //output[key] = null;
          /*
          if (_.isObject(output[key])) {
            Array.isArray(output[key]) ? output[key] = [] : output[key] = {};
          } else if (typeof output[key] === "string") {
            output[key] = "";
          } else if (typeof output[key] === "number") {
            output[key] = 0;
          } else {
            output[key] = null;
          }
          */
        } else if (output[key] === undefined) {
          output[key] = update[key];
        } else if (typeof update[key] === "object" || Array.isArray(update[key])) {
          output[key] = utils.deepMerge(output[key], update[key], debug, depth + 1);
        } else if (update[key] === undefined) {
          // Leave the prevState
        } else {
          output[key] = update[key];
        }
      }
      if (debug) {console.log("output after", utils.deepClone(output))}
      return output;
    }

    return update;
  },

  arraysHaveSameElements: function(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;

    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();

    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) return false;
    }

    return true;
  },

  deepEqualDebug: function(obj1, obj2) {
    return utils.deepEqual(utils.deepClone(obj1), utils.deepClone(obj2), new WeakSet(), true);
  },

  deepEqual: function(obj1, obj2, visitedObjects = new WeakSet(), debug = false) {

    // Check if both inputs are objects
    if (typeof obj1 === 'object' && obj1 !== null && typeof obj2 === 'object' && obj2 !== null) {
      if (visitedObjects.has(obj1)) {
        console.log("deepEqual cycled obj1", obj1);
        return true;
      } 
      if (visitedObjects.has(obj2)) {
        console.log("deepEqual cycled obj2", obj2);
        return true;
      }
      visitedObjects.add(obj1);
      visitedObjects.add(obj2);

      // Strip out keys that are undefined
      const keys1 = Object.keys(obj1).filter(key => obj1[key] !== undefined);
      const keys2 = Object.keys(obj2).filter(key => obj2[key] !== undefined);

      // Check if the inputs have different lengths
      if (keys1.length !== keys2.length) {
        if (debug) {console.log("deepEqual keys1.length !== keys2.length", utils.js(keys1), utils.js(keys2))}
        if (debug) {console.log("obj1", obj1, Object.keys(obj1))}
        if (debug) {console.log("obj2", obj2, Object.keys(obj2))}
        return false;
      }

      // Recursively compare each property
      for (let key of keys1) {
        if (!keys2.includes(key)) {
          if (debug) {console.log("deepEqual !keys2.includes(key)", key)}
          return false;
        } else {
          if (!utils.deepEqual(obj1[key], obj2[key], visitedObjects, debug)) {
            return false;
          }
        }
      }

      return true;
    } else if (obj1 === obj2) {
      // If inputs are not objects (or are null), use strict equality check
      return true;
    } else {
      if (debug) {console.log("deepEqual obj1 !== obj2", obj1, obj2)}
      return false;
    }
  },

  /*
  In this updated function, we've added an isArray helper function that uses Array.isArray to check if a value is an array. We then use this function in our check for whether the values at a key in both objects are objects. If they are arrays, we iterate over their elements and check for conflicts, but ignore any elements that are null in either array. If the lengths of the arrays are different, we still consider that a conflict, as it's a structural difference between the two objects.
  */
  checkConflicts: function(obj1, obj2, pathString = "") {
    // Helper functions
    const isObject = (value) => typeof value === 'object' && value !== null;
    const isArray = (value) => Array.isArray(value);

    let conflict = false;

    // Iterate over keys in obj1
    Object.keys(obj1).forEach(key => {
      if (obj2[key]) {
        if (isObject(obj1[key]) && isObject(obj2[key])) {
          // Check if value is an array
          if (isArray(obj1[key]) && isArray(obj2[key])) {
            // Only create conflict if non-null elements are different
            if (obj1[key].length !== obj2[key].length) {
              conflict = true;
            } else {
              for (let i = 0; i < obj1[key].length; i++) {
                if (obj1[key][i] !== null && obj2[key][i] !== null && obj1[key][i] !== obj2[key][i]) {
                  conflict = true;
                  break;
                }
              }
            }
          } else {
            // Recursive check for nested objects
            if (utils.checkConflicts(obj1[key], obj2[key], pathString + "." + key)) {
              conflict = true;
            }
          }
        } else if (obj1[key] !== obj2[key]) {
          // Conflict detected when values are different
          console.log("Conflict in merge: " + pathString + "." + key + " " + JSON.stringify(obj1[key]) + " " + JSON.stringify(obj2[key]));
          conflict = true;
        }
      }
    });

    return conflict;
  },

  // The function aims to compare two objects (or arrays) and return the differences between them. 
  // If the input objects are not equal, it goes through each key in the second object (obj2) and checks if there is a corresponding key in the first object (obj1). 
  // If there isn't, or if the corresponding value in obj1 is null, it takes the value from obj2.
  // This can return sparse arrays
  // Returns undefined if no difference, null can be used to delete 
  getObjectDifference: function(obj1, obj2, debug = false) {

    if (!_.isObject(obj1) && obj1 === obj2) {
      return undefined;
    }

    // Keep null for delete
    if (obj2 === null) {
      return obj2;
    }

    if (obj1 === undefined || !_.isObject(obj2)) {
      if (debug) {console.log("getObjectDifference debug obj1 undefined", obj1, obj2)}
      return obj2;
    }

    // Both empty array
    if (Array.isArray(obj1) && Array.isArray(obj2) && _.isEmpty(obj1) && _.isEmpty(obj2)) {
      return undefined;
    }

    // Both empty objects
    if (_.isObject(obj1) && _.isObject(obj2) && _.isEmpty(obj1) && _.isEmpty(obj2)) {
      return undefined;
    }

    if (_.isEmpty(obj2)) {
      if (debug) {console.log("getObjectDifference debug obj2 empty")}
      return obj2;
    }

    // By here obj2 is a non-empty object
    if (!_.isObject(obj1)) {
      if (debug) {console.log("getObjectDifference debug obj1 not an object but obj2 is", obj1, obj2)}
      return obj2;
    }

    let diffObj = Array.isArray(obj2) ? [] : {};

    _.each(obj2, (value, key) => {
      let diff = utils.getObjectDifference(obj1[key], value, debug);
      if (diff === undefined) {
        // Null treated as a placeholder in the case of arrays
        // eslint-disable-next-line no-unused-expressions
        Array.isArray(diffObj) ? diffObj.push(null) : undefined;
      } else if (!_.isObject(diff)) {
        Array.isArray(diffObj) ? diffObj.push(diff) : diffObj[key] = diff;
      } else if (!_.isEmpty(diff)) {
        Array.isArray(diffObj) ? diffObj.push(diff) : diffObj[key] = diff;
      } else { // Empty object
        // Empty object treated as a placeholder in the case of arrays
        Array.isArray(diffObj) ? diffObj.push(null) : diffObj[key] = diff;
      }
    });
    
    _.each(diffObj, (value, key) => {
      if (Array.isArray(value) && value.length === 0) {
        delete diffObj[key];
      } else if (Array.isArray(value) && value.every(item => item === null)) {
        delete diffObj[key];
      } else if (value === undefined) {
        delete diffObj[key];
      }
    });

    // If null then this is being used to delete the object
    // If empty then all keys were deleted
    if (diffObj !== null && _.isEmpty(diffObj)) {
      diffObj = undefined;
    }

    if (debug && diffObj) {console.log("getObjectDifference diff object", diffObj)}

    return diffObj; // copy to avoid issues if the return value is modified
  },

  getIntersectionWithDifferentValues: function(obj1, obj2) {
    if (_.isEqual(obj1, obj2)) {
      return undefined
    }
    if (obj1 === undefined || obj2 === undefined) {
      return undefined;
    }
    if (Array.isArray(obj1) && _.isEmpty(obj1) && Array.isArray(obj2) && _.isEmpty(obj2)) {
      return undefined;
    }
    if (_.isEmpty(obj1) && _.isEmpty(obj2)) {
      return undefined;
    }
    if (_.isEmpty(obj1)) {
      return obj1;
    }
    if (_.isEmpty(obj2)) {
      return obj1;
    }
    let diffObj = Array.isArray(obj1) && Array.isArray(obj2) ? [] : {};
    _.each(obj1, (value, key) => {
      if (key in obj2) {
        if (_.isObject(value) && _.isObject(obj2[key])) {
          let diff = utils.getIntersectionWithDifferentValues(value, obj2[key]);
          if (diff !== undefined) {
            diffObj[key] = diff;
          }
        } else if (!_.isEqual(value, obj2[key])) {
          if (Array.isArray(obj1) && obj2[key] === null) {
            // Null treated as a placeholder in the case of arrays
            // So we can deal with JS sparse arrays
          } else {
            diffObj[key] = value;
          }
        }
      }
    });
    if (_.isEmpty(diffObj)) {
      return undefined;
    }
    return diffObj;
  },

  identifyAbsentKeysWithNull: function(obj1, obj2) {
    // Check if the inputs are both plain objects
    if (!_.isPlainObject(obj1) || !_.isPlainObject(obj2)) {
      return undefined;
    }
    let diffObj = {};
    _.each(obj1, (value, key) => {
      if (!_.has(obj2, key)) {
        // Key is not present in obj2
        diffObj[key] = null;
      } else if (_.isPlainObject(value) && _.isPlainObject(obj2[key])) {
        // If the value is an object, recurse into it
        let diff = utils.identifyAbsentKeysWithNull(value, obj2[key]);
        if (diff !== undefined && !_.isEmpty(diff)) {
          diffObj[key] = diff;
        }
      }
    });
    return _.isEmpty(diffObj) ? undefined : diffObj;
  },

  // Flatten hierarchical object and merge keys into children
  flattenObjects: function(objs) {
    const result = {};
    let parent2id = { root: "" };
    objs.forEach((obj) => {
      assert(obj.name, "Object missing name");
      let id;
      if (obj.name === "root") {
        id = "root";
      } else {
        if (!obj.parentName) {
          id = obj.name;
          obj["id"] = id;
          //console.log("flattenObjects object is at root of tree", obj.name);
        } else {
          const parentId = parent2id[obj.parentName];
          id = `${parentId}.${obj.name}`;
          assert(!result[id], "Object id already in use " + id);
          obj["id"] = id;
          obj["parentId"] = parentId;
          // Merge all the objects of obj[id] into obj[obj["parentId"]]
          const parent = result[parentId];
          obj = utils.deepMerge(parent, obj);
        }
      }
      parent2id[obj.name] = id
      result[id] = obj;
    });
    return result;
  },

  updatedAt: function() {
    const currentDateTime = new Date();
    const utcDateTime = currentDateTime.toISOString();
    const data = {
      date: utcDateTime,
      timezone: "UTC"
    };
    return data;
  },

  timeNow: function() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const timeString = `${hours}:${minutes}:${seconds}.${milliseconds}`;
    return timeString;
  },
  
  parseRegexString: function(regexStr) {
    const regex = /^\/(.+)\/(.*)$/;
    const match = regexStr.match(regex);
    if (match) {
        return {
            pattern: match[1],
            flags: match[2]
        };
    } else {
        // If not in regex format, treat as simple string with no flags
        return {
            pattern: regexStr,
            flags: ""
        };
    }
  },

  djb2Hash: function(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // convert to unsigned 32-bit integer
  },

  //As of the ECMAScript 2015 specification (also known as ES6), the order of keys in 
  // JavaScript objects is guaranteed for certain types of keys (e.g. strings here)
  taskHashSortKeys: function(obj) {
    if (typeof obj !== 'object' || obj === null) {
        // Not an object or array, return as is
        return obj;
    }
    if (Array.isArray(obj)) {
        // Array, sort items
        return obj.map(utils.taskHashSortKeys);
    }
    // Object, sort keys
    return Object.keys(obj)
        .sort()
        .reduce((result, key) => {
            // Recursively sort keys in the object
            result[key] = utils.taskHashSortKeys(obj[key]);
            return result;
        }, {});
  },

  taskHash: function(task) {
    if (!task) {
      return 0; // should error here?
    }
    // Only hash information that is shared between all nodes and Hub
    const taskCopy = utils.cleanForHash(task);
    const sortedObj = utils.taskHashSortKeys(taskCopy);
    const hash = utils.djb2Hash(JSON.stringify(sortedObj));
    //console.log("HASH VALUE", hash);
    return hash;
  },

  removeNullKeys: function(obj, depth = 0) {
    // Base case: if the input isn't an object, return it as is
    if (typeof obj !== 'object' || obj === null) return obj;
    // Don't delete null entries in arrays (used for virtual arrays)
    if (Array.isArray(obj)) {
      return obj.map(utils.removeNullKeys);
    }
    // Iterate over the object's keys
    let allNull;
    for (let key in obj) {
      if (allNull === undefined) {
        allNull = true;
      }
      // If the current key's value is null, delete the key
      if (obj[key] === null && depth > 0) {
        delete obj[key];
      // Do not delete top level objects e.g. task.request
      } else if (_.isEmpty(obj[key]) && depth === 0) {
      // Otherwise, if it's an non-empty object recursively call removeNullKeys
      } else if (typeof obj[key] === 'object') {
        obj[key] = utils.removeNullKeys(obj[key], depth + 1);
        if (obj[key] === null) {
          delete obj[key];
        }
      }
      if (obj[key] !== null) {
        allNull = false;
      }
    }
    if (allNull && depth > 0) {
      //console.log("All keys are null at depth", depth, obj);
      return null;
    }
    return obj;
  },

  removeEmptyKeys: function(obj, depth = 0) {
    if (_.isEmpty(obj)) {
      return null;
    }
    if (Array.isArray(obj)) {
      return obj;
    }
    if (typeof obj === 'object') {
      for (let key in obj) {
        if (_.isEmpty(obj[key])) {
          delete obj[key];
        }
        if (typeof obj[key] === 'object') {
          obj[key] = utils.removeEmptyKeys(obj[key], depth + 1);
        }
        if (obj[key] === null) {
          delete obj[key];
        }
      }
    }
  },

  // This is having side-effects on task
  nodeActiveTasksStoreSet_async: async function(setActiveTask_async, task) {
    //console.log("nodeActiveTasksStoreSet_async", task.id, "state:",task?.state?.current);
    task.meta = task.meta || {};
    delete task.node.origTask; // delete so we do not have an old copy in origTask
    task.node["origTask"] = utils.deepClone(task); // deep copy to avoid self-reference
    task.meta["hash"] = utils.taskHash(task);
    //utils.removeNullKeys(task);
    // We do not store the start as this would be treating the start command like an update
    if (task.node.command != "start") {
      //console.log("nodeActiveTasksStoreSet_async task.state", task.state);
      //delete task.meta.modified; // generated on the Hub
      //task.nodes = task.nodes || {};
      //task.nodes[task.node.id] = utils.deepClone(task.node);
      await setActiveTask_async(task);
    }
    utils.debugTask(task);
    
  },

  cleanForHash: function (task) {
    if (!task) {
      return {};
    }
    let taskCopy = utils.deepClone(task);
    delete taskCopy.node;
    delete taskCopy.nodes;
    delete taskCopy.user;
    delete taskCopy.users;
    delete taskCopy.permissions;
    delete taskCopy.meta;
    delete taskCopy.connections; // Could be injected and not synced yet
    // The node may have copied the commands or not
    delete taskCopy.command;
    delete taskCopy.commandArgs;
    // Because this is unique to each node (we could have a hash for each node)
    if (taskCopy?.state?.last) {
      delete taskCopy.state.last;
      // Otherwise we can end up with an empty state object that causes hash mismatch
      if (_.isEmpty(taskCopy.state)) {
        delete taskCopy.state;
      }
    }
    // Delete any empty objects because this was causing hash mismathc e.g. one storage does not have the key and the other has {}
    // Should look more into this...
    utils.removeEmptyKeys(taskCopy);
    // Because React is adding token during the sending of the Task so it will not be stored
    delete taskCopy.tokens;
    // Sending null is used to delete so we can get mismatches when the entry is deleted
    utils.removeNullKeys(taskCopy);
    return taskCopy;
  },

  nodeDiff: function(lastTask, task) {
    utils.debugTask(task);
    if (task.node.command === "ping" || task.node.command === "pong") {
      return task;
    }
    if (!lastTask) {
      return task;
    }
    const taskClone = utils.deepClone(task); // Avoid modifyng object that was passed in
    const lastTaskClone = utils.deepClone(lastTask); // Avoid modifyng object that was passed in
    if (lastTaskClone.id !== taskClone.id) {
      throw new Error("ERROR nodeDiff lastTaskClone.id !== taskClone.id");
    }
    // Things we do not care about so delete to improve perf
    //if (taskClone?.meta?.modified) delete taskClone.meta.modified;
    //if (lastTaskClone?.meta?.modified) delete lastTaskClone.meta.modified;
    if (taskClone?.nodes) delete taskClone.nodes;
    if (lastTaskClone?.nodes) delete lastTaskClone.nodes;
    // Cannot transmit functions
    for (const key of ['operators', 'services', 'ceps']) {
      if (taskClone[key]) {
        //console.log("cleanForHash key", key);
        const entries = Object.keys(taskClone[key]);
        for (const entry of entries) {
        //console.log("cleanForHash entry", entry);
          if (taskClone[key][entry]["module"]) {
            delete taskClone[key][entry]["module"];
          }
        }
      }
    }
    //console.log("nodeDiff in lastTaskClone.output, task.output", lastTaskClone?.output, task.output);
    let diffTask;
    if (taskClone.node?.origTask) {
      // Get what has changed relative to the values of the task when recreated
      diffTask = utils.getObjectDifference(taskClone.node.origTask, taskClone)
      // Get what has changed relative to the latest task in storage (i.e. account for updates)
      diffTask = utils.getObjectDifference(lastTaskClone, diffTask);
    } else {
      diffTask = utils.getObjectDifference(lastTaskClone, taskClone);
    }
    if (diffTask === undefined) diffTask = {};
    const diffValues = utils.getIntersectionWithDifferentValues(lastTaskClone, diffTask);
    //console.log("utils.getObjectDifference what was in storage lastTaskClone?.input:", JSON.stringify(lastTaskClone?.input, null, 2));
    //console.log("utils.getObjectDifference what changed diffTask?.input:", JSON.stringify(diffTask?.input, null, 2));
    //console.log("utils.getObjectDifference final diffValues?.input:", JSON.stringify(diffValues?.input, null, 2));
    const cleanDiffValues = utils.cleanForHash(diffValues);
    const hashDiff = utils.taskHash(cleanDiffValues);
    diffTask["instanceId"] = taskClone.instanceId;
    diffTask["id"] = taskClone.id;
    diffTask["node"] = taskClone.node;
    diffTask["user"] = taskClone.user;
    diffTask["meta"] = taskClone.meta || {};
    if (taskClone.meta?.locked) diffTask.meta["locked"] = taskClone.meta.locked;
    // This hash gives us an id for the particular value of the task instance
    // It might be better to use updatedAt
    if (taskClone.meta?.hash) diffTask.meta["hash"] = taskClone.meta.hash;
    // Which properties of the lastTaskClone differ from the task
    //console.log("cleanDiff", cleanDiff, lastTaskClone, taskClone);
    // Allows us to check only the relevant part of the lastTaskClone
    // More specific than testing for the hash of the entire lastTaskClone
    diffTask.meta["hashDiff"] = hashDiff;
    diffTask.meta["prevMessageId"] = lastTaskClone.meta.prevMessageId;
    diffTask.meta["messageId"] = taskClone.meta.messageId;
    // In theory we could enable the hash debug in the task
    const hashDebug = true;
    if (hashDebug || taskClone.config?.debug?.hash) {
      diffTask.meta["hashDebugLastTaskValues"] = utils.deepClone(cleanDiffValues);
    }
    //console.log("nodeDiff out task.output", diffTask.output);
    return diffTask;
  },

  isEmpty: function(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
  },
  
  checkHashDiff: function(taskInStorage, task) {
    let taskCopy = utils.deepClone(task);
    // Sync is not relative to a current value so we cannot use hash
    // Start is not updating the task that contains the start command
    if (taskCopy?.commandArgs?.sync || taskCopy?.node?.commandArgs?.sync || taskCopy?.node?.command === "start") {
      return true;
    }
    const statesSupported = taskCopy?.node?.statesSupported;
    const statesNotSupported = taskCopy?.node?.statesNotSupported;
    if (statesSupported || statesNotSupported) {
      // We are sending full updates not diffs in this case
      // We could also set the task.meta.hashDiff to undefined on the Hub?
      return;
    }
    const expectedHash = task.meta.hashDiff;
    let diffOrigTask = utils.getIntersectionWithDifferentValues(taskInStorage, taskCopy);
    diffOrigTask = utils.cleanForHash(diffOrigTask);
    if (diffOrigTask === undefined || utils.isEmpty(diffOrigTask)) {
      return true; // Thre is no diff to be concerned about
    }
    //console.log("diffOrigTask messageId:", task.meta.messageId, "cleanForHash diffOrigTask:", utils.cleanForHash(diffOrigTask));
    const localHash = utils.taskHash(diffOrigTask);
    if (expectedHash !== localHash) {
      if (task.meta.hashDebugLastTaskValues) {
        //console.error("Remote hashDebugLastTaskValues", task.meta.hashDebugLastTaskValues);
        let hashDiff = utils.getObjectDifference(taskInStorage, task.meta.hashDebugLastTaskValues) || {};
        hashDiff = utils.cleanForHash(hashDiff);
        console.error("checkHashDiff difference between the remote storage and the local storage", hashDiff);
      }
      console.error("Diff against local storage", JSON.stringify(diffOrigTask, null, 2));
      console.error("Diff against remote storage", task.meta?.hashDebugLastTaskValues);
      console.error("task in local storage:", taskInStorage);
      console.error("Incoming task:", taskCopy);
      throw new Error("ERROR: Task hashDiff does not match messageId:" + task.meta.messageId + " local:" + localHash + " remote:" + expectedHash);
    } else {
      //console.log("checkHashDiff OK");
    }
    return true;
  },

  nodeToTask: function(task) {
    if (task.node.stateLast) {
      // Diffs may not have the state information
      // Maybe we do not need to update in this case?
      if (!task.state) {
        task.state = {};
      }
      task.state["last"] = task.node.stateLast;
    }
    utils.debugTask(task);
    return task;
  },

  taskToNode_async: async function(task, nodeId, getActiveTask_async) {
    let taskClone = utils.deepClone(task); // We do not want any side efects on task
    utils.debugTask(taskClone, "input");
    //console.log("taskInNodeOut input taskClone.output", taskClone.output);
    if (!taskClone.command) {
      console.error("ERROR: Missing taskClone.command", taskClone);
      throw new Error(`Missing taskClone.command`);
    }
    const command = taskClone.command;
    const commandArgs = taskClone.commandArgs;
    const commandDescription = taskClone.commandDescription;
    // Initialize node when it does not exist e.g. when starting initial taskClone
    if (!taskClone.node) {
      taskClone.node = {};
    }
    // Clear down taskClone commands as we do not want these coming back from the Hub
    taskClone.node["command"] = command;
    delete taskClone.command;
    if (commandArgs) {
      // Deep copy because we are going to clear
      taskClone.node["commandArgs"] = JSON.parse(JSON.stringify(commandArgs));
    } else {
      taskClone.node["commandArgs"] = null;
    }
    delete taskClone.commandArgs;
    if (commandDescription) {
      taskClone.node["commandDescription"] = commandDescription;
    } else {
      taskClone.node["commandDescription"] = "";
    }
    delete taskClone.commandDescription;
    // Record the state of the taskClone as it leaves the node
    if (taskClone?.state?.current) {
      taskClone.node["stateLast"] = taskClone.state.current;
      delete taskClone.state.last;
    }
    taskClone.node["id"] = nodeId;
    // The coprocessor processes command init but th task has not been stored yet so diff cannot be calculated
    if (command === "start" || command === "partial" || commandArgs?.sync || command === "init") {
      return taskClone;
    }
    let diffTask;
    if (taskClone.instanceId) {
      const lastTask = await getActiveTask_async(taskClone.instanceId);
      // This assumes taskClone is not a partial object e.g. in sync
      if (taskClone.node.command === "update") {
        const taskCleaned = utils.cleanForHash(taskClone);
        //console.log("taskInNodeOut taskCleaned", taskCleaned);
        const origTaskCleaned = utils.cleanForHash(taskClone.node.origTask);
        //console.log("taskInNodeOut origTaskCleaned", origTaskCleaned);
        // Not sure about removing outputs better to leave them
        delete taskCleaned.output;
        delete origTaskCleaned.output;
        const keysNulled = utils.identifyAbsentKeysWithNull(origTaskCleaned, taskCleaned);
        if (keysNulled) {
          //console.log("taskInNodeOut keysNulled", keysNulled);
          taskClone = utils.deepMerge(taskClone, keysNulled);
        }
      }
      // This will use taskClone.node.origTask to identify the diff
      diffTask = utils.nodeDiff(lastTask, taskClone)
    } else {
      diffTask = taskClone;
    }
    //console.log("taskInNodeOut diffTask", JSON.stringify(diffTask, null, 2));
    utils.debugTask(diffTask, "output");
    return diffTask;
  },

  taskPing: function() {
    let currentDateTime = new Date();
    let currentDateTimeString = currentDateTime.toString();
    return {
      meta: {
        updatedAt: currentDateTimeString,
      },
      node: {},
      command: "ping",
    }
  },

  nanoid8: function() {
    return nanoid(8);
  },

  logTask: function(task, ...message) {
    const prevMessageId = task?.meta?.prevMessageId || "";
    const messageId = task?.meta?.messageId || "";
    const id = task?.id || "";
    const instanceId = task?.instanceId || "";
    console.log(`${utils.timeNow()} ${prevMessageId} -> ${messageId}`, id, instanceId, ...message);
  },

  findCyclicReference: function(obj) {
    const visited = new WeakMap();
    const path = [];
  
    function isCyclic(obj, key) {
      if (typeof obj !== 'object' || obj === null) {
        return null;
      }
  
      if (visited.has(obj)) {
        return visited.get(obj).concat([key]);
      }
  
      visited.set(obj, path.concat([key]));
  
      for (let k in obj) {
        if (obj[k]) {
          path.push(k);
          const cyclePath = isCyclic(obj[k], k);
          if (cyclePath) {
            return cyclePath;
          }
          path.pop();
        }
      }
  
      return null;
    }
  
    return isCyclic(obj);
  },

  // Adding key of object as id in object
  add_index: function(config) {
    for (const key in config) {
      if (config[key]) {
        config[key]["id"] = key;
      }
    }
  },

  filter_in_list: function (task, filter_list) {
    const taskCopy = { ...task }; // or const objCopy = Object.assign({}, obj);
    for (const key in taskCopy) {
      if (!filter_list.includes(key)) {
        delete taskCopy[key];
      }
    }
    return taskCopy;
  },

  authenticatedGroup_async: async function (groupId, tribe) {
    let authenticated = false;
    if (tribe) {
      if (tribe.name === "god") {
        authenticated = true;
      } else {
        const groups = tribe.groups;
        if (!groups) {
          //console.log("Tribe " + tribe.name + " has no groups");
          authenticated = true;
        } else if (groups.includes(groupId)) {
          authenticated = true;
        }
      }
    }
    //console.log("authenticatedGroup_async " + groupId + " " + tribe.name + " " +authenticated);
    return authenticated;
  },

  filterGroupIdsInTribe_async: async function(userGroupIds, tribe) {
    // Use map to apply the async function to each element, creating an array of promises
    const checkGroupPromises = userGroupIds.map(groupId => utils.authenticatedGroup_async(groupId, tribe));
    // Use Promise.all to wait for all promises to resolve
    const checkResults = await Promise.all(checkGroupPromises);
    // Filter the original array based on the results
    const filteredUserGroupIds = userGroupIds.filter((_, index) => checkResults[index]);
    return filteredUserGroupIds;
  },

  authenticatedTask_async: async function (taskID, taskPermissions, userGroupIdsInTribe) {
    //utils.debugTask(taskPermissions);
    let authenticated = false;
    let groupId;
    if (taskPermissions) {
      //console.log("task.permissions", taskPermissions);
      for (const permissionGroupId of taskPermissions) {
        if (permissionGroupId === "*") {
          authenticated = true;
          //console.log("authenticatedTask_async * " + taskID + " " + userId + " " + groupId  + " " + tribeId + " " + authenticated);
          groupId = '*';
          break;
        }
        if (userGroupIdsInTribe.includes(permissionGroupId)) {
          authenticated = true;
          groupId = permissionGroupId;
          break;
        }
      }
    }
    //console.log("authenticatedTask_async " + taskID + " " + userId + " " + tribeId + " " + authenticated);
    return [authenticated, groupId];
  },

  deepClone: function(obj) {
    if (obj === null || typeof obj !== 'object') {
      // Return primitive types, functions, and null
      return obj;
    }
    if (Array.isArray(obj)) {
      // Handle arrays
      return obj.map(utils.deepClone);
    }
    if (obj instanceof Date) {
      // Handle Date
      return new Date(obj);
    }
    if (obj instanceof RegExp) {
      // Handle RegExp
      return new RegExp(obj);
    }
    // Handle Function
    if (typeof obj === 'function') {
      return obj;
    }
    // Handle objects
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = utils.deepClone(obj[key]);
      }
    }
    return clonedObj;
  },

  assertWarning: function(condition, message) {
    if (!condition) {
      console.warn(`Assertion Warning: ${message}`);
    }
  },

  sortKeys: function(obj) {
    // If obj is null or not an object, return as is
    if (obj === null || typeof obj !== 'object') return obj;
  
    // If obj is an array, return as is
    if (Array.isArray(obj)) return obj;
  
    // Sort the keys of the object
    const sortedKeys = Object.keys(obj).sort();
  
    // Create a new object and copy over the values,
    // recursively sorting any nested objects
    const sortedObj = {};
    for (const key of sortedKeys) {
      sortedObj[key] = utils.sortKeys(obj[key]);
    }
    return sortedObj;
  },

  getCallerFunctionDetails: function() {
    const stack = new Error().stack;
    const stackLines = stack.split('\n');
    const isBrowser = typeof window === 'object';
    if (isBrowser) {
      if (stackLines[2]) {
        // For Firefox
        let match = stackLines[2].match(/(.*)@(.+):(\d+):(\d+)/);
        if (match) {
          return {
            functionName: match[1].trim(),
          };
        }
      }
    } else if (stackLines[3]) {
      // For Node
      let match = stackLines[3].match(/at (.*) \(?(.*):(\d+):(\d+)\)?/);
      if (match) {
        return {
          functionName: match[1].trim(),
          filePath: match[2],
          lineNumber: match[3],
          columnNumber: match[4]
        };
      }
    }
    return null;
  },

  deleteKeysBasedOnMask: function (obj, mask) {
    // Directly check for the wildcard '*' in mask.
    if (mask['*']) {
      //console.log("Found * in mask, deleting all keys from obj");
      Object.keys(obj).forEach(key => {
        delete obj[key];
      });
    } else {
      // No wildcard, proceed with individual key deletion.
      for (const key in mask) {
        if (Object.prototype.hasOwnProperty.call(mask, key)) {
          if (typeof mask[key] === 'object' && mask[key] !== null && typeof obj[key] === 'object' && obj[key] !== null) {
            // If the mask key is an object, recurse.
            utils.deleteKeysBasedOnMask(obj[key], mask[key]);
          } else {
            // Otherwise, delete the key from the obj.
            delete obj[key];
          }
        }
      }
    }
  },

  checkModified: function (task, path) {
    let result = false;
    if (task?.meta?.modified) {
      const T = utils.createTaskValueGetter(task);
      if (T(path) !== undefined) {
        // split path into dot separated parts
        const parts = path.split(".");
        let currentPath = task.meta.modified;
        for (const p of parts) {
          //console.log("checkModified", p, utils.js(currentPath))
          currentPath = currentPath[p];
          if (currentPath === true) {
            result = true;
            break;
          } else if (currentPath === undefined) {
            break;
          }
        }
      }
    }
    return result;
  },

  checkSyncEvents: function (task, path) {
    let result = false;
    if (task?.node?.commandArgs?.syncEvents) {
      const T = utils.createTaskValueGetter(task);
      if (T(path) !== undefined) {
        // split path into dot separated parts
        const parts = path.split(".");
        let currentPath = task.node.commandArgs.syncEvents;
        for (const p of parts) {
          //console.log("checkSyncEvents", p, utils.js(currentPath))
          currentPath = currentPath[p];
          if (currentPath === true) {
            result = true;
            break;
          } else if (currentPath === undefined) {
            break;
          }
        }
        // our path is not reaching to the leaves so we return true beacuse some part of the object has changed
        if (typeof currentPath === 'object') {
          result = true;
        }
      }
    }
    console.log("checkSyncEvents", path, result);
    return result;
  },

  js: function(obj) {
    return JSON.stringify(obj, null, 2)
  },

  debugTask: async function(task, ...args) {
    let context = args.join(',') || '';
    if (task === undefined) {
      throw new Error("Task undefined in debugTask");
    }
    // Could add continuous assertion (it runs before debug info is collected)

    // Can set task.debug via configuration
    // Comment out this line to see all the debug messages for everything
    if (!task?.config?.debug?.debugTask) {return}

    task = utils.deepClone(task); // Avoiding issues with logging references
    const isBrowser = typeof window === 'object';
    const command = task.command || task?.node?.command;
    const commandArgs = task.commandArgs || task?.node?.commandArgs;
    const commandDescription = task.commandDescription || task?.node?.commandDescription;
    if (command === "ping" || command === "pong" || command === "partial") {
      return;
    }
    const callerDetails = this.getCallerFunctionDetails();
    const callerDetailsText = callerDetails ? callerDetails.functionName + " " + callerDetails.filePath + ":" + callerDetails.lineNumber : null;
    const contextText = callerDetailsText ? context + " " + callerDetailsText : context;
    let logParts = ["DEBUGTASK"];
    logParts.push(utils.timeNow());
    if (contextText) {
      logParts.push(contextText);
    }
    if (commandDescription) {
      logParts.push(commandDescription);
    }
    if (task.id) {logParts.push(`id: ${task.id}`)}
    if (task.instanceId) {logParts.push(`instanceId: ${task.instanceId}`)}
    if (task?.meta?.messageId) {
      logParts.push(`messageId: ${task.meta.messageId}`);
    }
    if (task?.state?.current) {
      logParts.push(`state.current: ${task.state.current}`);
    }
    if (task?.shared?.configTreeHubconsumerTasks?.children) {
      const title = task.shared.configTreeHubconsumerTasks.children["root.user"].title;
      logParts.push("configTreeHubconsumerTasks children root.user title", title);
    }
    if (isBrowser) {
      logParts.push("task:", task);
    }
    if (task?.state?.tasksTree) {
      //logParts.push("tasksTree", task.state.tasksTree);
    }
    if (task?.meta?.hashDebugLastTaskValues) {
      //logParts.push("task.meta.hashDebugLastTaskValues:", JSON.stringify(task.meta.hashDebugLastTaskValues));
    }
    if (task?.meta?.hashTask?.state?.current) {
      //logParts.push("task?.meta?.hashTask?.state?.current:", task?.meta?.hashTask?.state?.current);
    }
    if (task?.output?.CEPCount) {
      //logParts.push("task.output.CEPCount", task.output.CEPCount);
    }
    if (task?.node?.coprocessing) {
      //logParts.push("task.node.coprocessing", task.node.coprocessing);
    }
    if (task?.node?.coprocessing) {
      //logParts.push("task.node.coprocessing", task.node.coprocessing);
    }
    if (task?.nodes) {
      //logParts.push("Nodes:", Object.keys(task.nodes));
    }
    if (commandArgs?.sync) {
      //logParts.push("commandArgs.syncTask", commandArgs.syncTask);
    }
    if (task?.config?.nextTask) {
      logParts.push("config.nextTask", task.config?.nextTask);
    }
    if (task.tribe) {
      logParts.push("task.tribe", task.tribe);
    }
    /*
    if (command && !commandDescription) {
      console.log(logParts.join(' '));
      throw new Error("ERROR debugTask: task.commandDescription is undefined");
    }
    */
    /*
    if (task?.node?.id && !task.node.type) {
      logParts.push('node:', utils.js(task.node));
      console.log(logParts.join(', '));
      throw new Error("task?.node?.id && !task.node.type");
    }
    logParts.push('nodeId:', task?.node?.id);
    */
    /*
    if (!command && task.nodes && Object.keys(task.nodes).length) {
      logParts.push('task:', utils.js(task));
      console.log(logParts.join(' '));
      throw new Error("ERROR debugTask: no command");
    }
    */
    /*
    if (command === "error") {
      logParts.push('task:', utils.js(task));
      console.log(logParts.join(' '));
      throw new Error("ERROR command === error");
    }
    */
    //logParts.push("task.services", JSON.stringify(task.services, null, 2));
    //logParts.push("task.ceps", JSON.stringify(task.ceps, null, 2));
    // Use a single console.log at the end of debugTask
    console.log(logParts.join(', '));
  },

  assert: function(condition, msg = 'Assertion failed') {
    assert(condition, msg);
  },

};

export { utils };