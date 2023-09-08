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

  createTaskValueGetter: function(task) {
    return function (arg1, value) {
      if (arguments.length === 1) {
        if (typeof arg1 === 'string') {
          return utils.getNestedValue(task, arg1);
        } if (typeof arg1 === 'object') {
          utils.setNestedProperties(arg1);
          task = utils.deepMerge(task, arg1);
          return task;
        } else {
          console.error('Invalid argument type', arg1);
          throw new Error('Invalid argument type');
        }
      } else if (arguments.length === 2) {
        let mod = {[arg1]: value}
        utils.setNestedProperties(mod);
        task = utils.deepMerge(task, mod);
        return task;
        //console.log("createTaskValueGetter set ", arg1, value)
      } else if (!arg1 && !value) {
        return task;
      } else {
        const res = utils.getNestedValue(task, arg1);
        //console.log("createTaskValueGetter get ", arg1, res)
        return res;
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

  deepMergeProcessor: function(prevState, update, processorIn) {
    const processor = JSON.parse(JSON.stringify(processorIn));
    let result = utils.deepMerge(prevState, update);
    result.processor = processor;
    //utils.removeNullKeys(result);
    return result;
  },

  deepMergeHub: function(prevState, update, hubIn) {
    const hub = JSON.parse(JSON.stringify(hubIn));
    let result = utils.deepMerge(prevState, update);
    result.hub = hub;
    //utils.removeNullKeys(result);
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
        output = JSON.parse(JSON.stringify(prevState));
      }
      if (debug) {console.log("output before", JSON.parse(JSON.stringify(output)))}
      if (debug) {console.log("update before", JSON.parse(JSON.stringify(update)))}
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
      if (debug) {console.log("output after", JSON.parse(JSON.stringify(output)))}
      return output;
    }

    return update;
  },

  deepEqualDebug: function(obj1, obj2) {
    return utils.deepEqual(obj1, obj2,new WeakSet(), true);
  },

  deepEqual: function(obj1, obj2, visitedObjects = new WeakSet(), debug = false) {
    // Check if objects are cyclic
    if (visitedObjects.has(obj1) || visitedObjects.has(obj2)) {
      console.log("deepEqual cycled");
      return true;
    }

    // Check if both inputs are objects
    if (typeof obj1 === 'object' && obj1 !== null && typeof obj2 === 'object' && obj2 !== null) {
      visitedObjects.add(obj1);
      visitedObjects.add(obj2);

      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);

      // Check if the inputs have different lengths
      if (keys1.length !== keys2.length) {
        if (debug) {console.log("deepEqual keys1.length !== keys2.length", keys1, keys2)}
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

    if (obj1 === obj2) {
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
      return Array.isArray(obj1) ? [] : {};
    }
  
    if (!_.isObject(obj1) || !_.isObject(obj2)) {
      return undefined;
    }
  
    let diffObj = Array.isArray(obj1) && Array.isArray(obj2) ? [] : {};
  
    _.each(obj1, (value, key) => {
      if (obj2[key]) {
        if (_.isObject(value) && _.isObject(obj2[key])) {
          let diff = utils.getIntersectionWithDifferentValues(value, obj2[key]);
          if (!_.isEmpty(diff)) {
            diffObj[key] = diff;
          }
        } else if (!_.isEqual(value, obj2[key])) {
          if (Array.isArray(obj1) && obj2[key] === null) {
            // Null treated as a placeholder in the case of arrays
          } else {
            diffObj[key] = value;
          }
        }
      }
    });
  
    return diffObj;
  },

  // Flatten hierarchical object and merge keys into children
  flattenObjects: function(objs) {
    const res = {};
    let parent2id = { root: "" };
    objs.forEach((obj) => {
      assert(obj.name, "Object missing name");
      let id;
      if (obj.name === "root") {
        id = "root";
      } else {
        if (!obj.parentType) {
          id = obj.name;
          obj["id"] = id;
          //console.log("flattenObjects object is at root of tree", obj.name);
        } else {
          const parentId = parent2id[obj.parentType];
          id = `${parentId}.${obj.name}`;
          assert(!res[id], "Object id already in use");
          obj["id"] = id;
          obj["parentId"] = parentId;
          // Merge all the objects of obj[id] into obj[obj["parentId"]]
          const parent = res[parentId];
          obj = utils.deepMerge(parent, obj);
        }
      }
      parent2id[obj.name] = id
      res[id] = obj;
    });
    return res;
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
    // Only hash information that is shared between all processors and hub
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

  // This is having side-effects on task
  processorActiveTasksStoreSet_async: async function(activeTasksStore_async, task) {
    task.meta = task.meta || {};
    delete task.processor.origTask; // delete so we do not have an old copy in origTask
    task.processor["origTask"] = JSON.parse(JSON.stringify(task)); // deep copy to avoid self-reference
    task.meta["hash"] = utils.taskHash(task);
    //utils.removeNullKeys(task);
    // We do not store the start as this would be treating the start command like an update
    if (task.processor.command != "start") {
      //console.log("processorActiveTasksStoreSet_async", task);
      const taskCopy = utils.deepClone(task);
      delete taskCopy.meta.modified; // generated on the hub
      await activeTasksStore_async.set(taskCopy.instanceId, taskCopy);
    }
    utils.debugTask(task);
  },

  // This is having side-effects on task
  hubActiveTasksStoreSet_async: async function(setActiveTask_async, task) {
    task.meta = task.meta || {};
    delete task.hub.origTask; // delete so we do not have an old copy in origTask
    task.hub["origTask"] = JSON.parse(JSON.stringify(task)); // deep copy to avoid self-reference
    task.meta["hash"] = utils.taskHash(task);
    //utils.removeNullKeys(task);
    // We do not store the start as this would be treating the start command like an update
    if (task.hub.command != "start") {
      //console.log("hubActiveTasksStoreSet_async task.state", task.state);
      const taskCopy = utils.deepClone(task);
      delete taskCopy.meta.modified; // generated on the hub
      await setActiveTask_async(taskCopy);
    }
    utils.debugTask(task);
  },

  cleanForHash: function (task) {
    let taskCopy = JSON.parse(JSON.stringify(task));
    delete taskCopy.hub;
    delete taskCopy.processor;
    delete taskCopy.processors;
    delete taskCopy.user;
    delete taskCopy.users;
    delete taskCopy.permissions;
    delete taskCopy.meta;
    // The processor may have copied the commands or not
    delete taskCopy.command;
    delete taskCopy.commandArgs;
    // Because this is unique to each processor (we could have a hash for each processor)
    if (taskCopy?.state?.last) {
      delete taskCopy.state.last;
    }
    // Sending null is used to delete so we can get mismatches when the entry is deleted
    utils.removeNullKeys(taskCopy);
    return taskCopy;
  },

  processorDiff: function(task) {
    if (task.processor.command === "ping") {
      return task;
    }
    const taskCopy = JSON.parse(JSON.stringify(task)); // Avoid modifyng object that was passed in
    const origTask = taskCopy.processor.origTask;
    if (!origTask) {
      return task;
    }
    //console.log("processorDiff in origTask.output, task.output", origTask?.output, task.output);
    const diffTask = utils.getObjectDifference(origTask, taskCopy) || {};
    //console.log("utils.getObjectDifference(origTask, taskCopy)", origTask, taskCopy);
    // Which properties of the origTask differ from the task
    let diffOrigTask = utils.getIntersectionWithDifferentValues(origTask, taskCopy);
    if (diffOrigTask === undefined) {
      diffOrigTask = {};
    }
    diffOrigTask = utils.cleanForHash(diffOrigTask);
    //console.log("diffOrigTask", diffOrigTask, origTask, taskCopy);
    if (!diffTask.meta) {
      diffTask.meta = {};
    }
    diffTask.meta["hash"] = taskCopy?.meta?.hash;
    // Allows us to check only the relevant part of the origTask
    // More specific than testing for the hash of the entire origTask
    diffTask.meta["hashDiff"] = utils.taskHash(diffOrigTask);
    const hashDebug = true;
    if (hashDebug || taskCopy.meta.hashDebug) {
      diffTask.meta["hashDiffOrigTask"] = JSON.parse(JSON.stringify(diffOrigTask));
      diffTask.meta.hashDiffOrigTask = utils.cleanForHash(diffTask.meta.hashDiffOrigTask);
    }
    diffTask["instanceId"] = taskCopy.instanceId;
    diffTask["id"] = taskCopy.id;
    diffTask["processor"] = taskCopy.processor;
    diffTask["user"] = taskCopy.user || {};
    delete diffTask.processor.origTask; // Only used internally
    //console.log("processorDiff out task.output", diffTask.output);
    return diffTask;
  },

  // This is only used in the Hub so could move into the Hub utils 
  hubDiff: function(origTask, task) {
    if (task.processor.command === "pong") {
      return task;
    }
    if (!origTask) {
      return task;
    }
    //console.log("hubDiff origTask.request, task.request", origTask.request, task.request);
    const taskCopy = JSON.parse(JSON.stringify(task)) // Avoid modifyng object that was passed in
    const diffTask = utils.getObjectDifference(origTask, taskCopy) || {};
    if (Object.keys(diffTask).length > 0) {
      diffTask["instanceId"] = taskCopy.instanceId;
      diffTask["id"] = taskCopy.id;
      diffTask["hub"] = taskCopy.hub;
      diffTask["processor"] = {};
      diffTask["processors"] = taskCopy.processors;
      diffTask["user"] = taskCopy.user;
      diffTask["users"] = taskCopy.users;
      if (!diffTask.meta) {
        diffTask["meta"] = {};
      }
      if (taskCopy.meta.locked) {
        diffTask.meta["locked"] = taskCopy.meta.locked;
      }
      diffTask.meta["hash"] = origTask.meta.hash;
      // Which properties of the origTask differ from the task
      let diffOrigTask = utils.getIntersectionWithDifferentValues(origTask, taskCopy);
      diffOrigTask = utils.cleanForHash(diffOrigTask);
      if (diffOrigTask === undefined) {
        diffOrigTask = {};
      }
      // Allows us to check only the relevant part of the origTask
      // More specific than testing for the hash of the entire origTask
      diffTask.meta["hashDiff"] = utils.taskHash(diffOrigTask);
      // In theory we could enable the hash debug in the task
      const hashDebug = true;
      if (hashDebug || taskCopy.meta.hashDebug) {
        diffTask.meta["hashTask"] = JSON.parse(JSON.stringify(origTask));
        diffTask.meta.hashTask = utils.cleanForHash(diffTask.meta.hashTask);
        diffTask.meta["hashDiffOrigTask"] = JSON.parse(JSON.stringify(diffOrigTask));
        diffTask.meta.hashDiffOrigTask = utils.cleanForHash(diffTask.meta.hashDiffOrigTask);
      }
      delete diffTask.hub.origTask; // Only used internally
    }
    //console.log("hubDiff diffTask.request", diffTask.request);
    return diffTask;
  },

  checkHashDiff: function(origTask, task) {
    const taskCopy = JSON.parse(JSON.stringify(task));
    const expectedHash = task.meta.hashDiff;
    let diffOrigTask = utils.getIntersectionWithDifferentValues(origTask, taskCopy);
    if (diffOrigTask === undefined) {
      diffOrigTask = {};
    }
    const localHash = utils.taskHash(diffOrigTask);
    if (expectedHash !== localHash) {
      if (task.meta.hashDiffOrigTask) {
        //console.error("Remote hashDiffOrigTask", task.meta.hashDiffOrigTask);
        let hashDiff = utils.getObjectDifference(origTask, task.meta.hashDiffOrigTask) || {};
        hashDiff = utils.cleanForHash(hashDiff);
        console.error("checkHashDiff hashDiff from remote", hashDiff);
      }
      diffOrigTask = utils.cleanForHash(diffOrigTask);
      console.error("Local diffOrigTask", diffOrigTask);
      console.error("Remote diffOrigTask", task.meta.hashDiffOrigTask);
      console.error("ERROR: Task hashDiff does not match local:" + localHash + " remote:" + expectedHash);
      return false;
    } else {
      //console.log("checkHashDiff OK");
    }
    return true;
  },

  checkHash: function(origTask, updatedTask) {
    if (!origTask) {
      console.log("origTask is undefined");
      return false;
    }
    const hashOrigTask = origTask.meta.hash;
    const hashUpdatedTask = updatedTask.meta.hash;
    if (hashOrigTask !== hashUpdatedTask) {
      console.error("ERROR: Task hash does not match origTask.meta.hash:", origTask.meta.hash, "updatedTask.meta.hash:", updatedTask.meta.hash);
      //console.error("ERROR: Task hash does not match hashOrigTask:", hashOrigTask, "hashUpdatedTask:", hashUpdatedTask);
      if (updatedTask.meta.hashTask) {
        //console.error("updatedTask.meta.hashTask", updatedTask.meta.hashTask, "origTask", origTask);
        console.error("updatedTask.meta.hashTask hash:", utils.taskHash(updatedTask.meta.hashTask), "origTask hash:", utils.taskHash(origTask));
        let hashDiff;
        //console.error("Task hash does not match in update local:" + hashOrigTask + " remote:" + hashUpdatedTask); //, origTask, updatedTask.meta.hashTask);
        hashDiff = utils.getObjectDifference(updatedTask.meta.hashTask, origTask) || {};
        hashDiff = utils.cleanForHash(hashDiff);
        console.error("Diff of local task compared to task on remote", hashDiff);
        hashDiff = utils.getObjectDifference(origTask, updatedTask.meta.hashTask) || {};
        hashDiff = utils.cleanForHash(hashDiff);
        console.error("Diff of remote task relative to local task", hashDiff);
      }
      return false;
    }
    //return true;
    return utils.checkHashDiff(origTask, updatedTask);
  },

  // Rename e.g. processorToTaskFunction, taskFunctionToProcessor, processorToHub, hubToProcessor
  processorInTaskOut: function(task) {
    if (task.processor.stateLast) {
      // Diffs may not have the state information
      // Maybe we do not need to update in this case?
      if (!task.state) {
        task.state = {};
      }
      task.state["last"] = task.processor.stateLast;
    }
    utils.debugTask(task);
    return task;
  },

  taskInProcessorOut_async: async function(task, processorId, activeTasksStore_async) {
    //console.log("taskInProcessorOut input task.output", task.output);
    if (!task.command) {
      console.error("ERROR: Missing task.command", task);
      throw new Error(`Missing task.command`);
    }
    const command = task.command;
    // Initialize processor when it does not exist e.g. when starting initial task
    if (!task.processor) {
      task.processor = {};
    }
    // Clear down task commands as we do not want these coming back from the hub
    task.processor["command"] = command;
    delete task.command;
    if (task.commandArgs) {
      // Deep copy because we are going to clear
      task.processor["commandArgs"] = JSON.parse(JSON.stringify(task.commandArgs));
    } else {
      task.processor["commandArgs"] = null;
    }
    delete task.commandArgs
    // Record the state of the task as it leaves the processor
    if (task?.state?.current) {
      task.processor["stateLast"] = task.state.current;
      delete task.state.last;
    }
    task.processor["id"] = processorId;
    if (command === "start" || command === "partial") {
      return task;
    }
    let diffTask = utils.processorDiff(task);
    //console.log("taskInProcessorOut diffTask task.output", task.output);
    // Send the diff considering the latest task storage state
    if (diffTask.instanceId) {
      const lastTask = await activeTasksStore_async.get(diffTask.instanceId);
      if (lastTask && lastTask.meta.hash !== diffTask.meta.hash) {
        delete diffTask.processor.origTask; // delete so we do not have ans old copy in origTask
        diffTask.processor["origTask"] = JSON.parse(JSON.stringify(lastTask));
        diffTask = utils.processorDiff(diffTask);
        //console.log("taskInProcessorOut_async latest task storage task.output", diffTask.output);
      } else {
        //console.log("taskInProcessorOut lastTask.id, lastTask.meta.hash, diffTask.meta.hash", lastTask.id, lastTask.meta.hash, diffTask.meta.hash);
      }
    } else {
      //console.log("taskInProcessorOut_async no diffTask.instanceId");
    }
    utils.debugTask(diffTask);
    return diffTask;
  },

  // Should not be sending processor from hub ? Allows processor specific config. Also initiatingProcessorId
  // The processor strips hub specific info because the Task Function should not interact with the Hub
  hubInProcessorOut: function(task) {
    const hub = JSON.parse(JSON.stringify(task.hub)); // deep copy
    delete task.hub;
    delete hub.id;
    task.processor = task.processor || {};
    task.processor["command"] = hub.command;
    task.processor["commandArgs"] = hub.commandArgs || {};
    task.processor = utils.deepMerge(task.processor, hub);
    if (hub.sourceProcessorId) {
      task.processor["sourceProcessorId"] = hub.sourceProcessorId;
    } else {
      delete task.processor.sourceProcessorId;
    }
    utils.debugTask(task);
    return task;
  },

  taskPing: function() {
    let currentDateTime = new Date();
    let currentDateTimeString = currentDateTime.toString();
    return {
      updatedeAt: currentDateTimeString,
      processor: {},
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
    console.log(prevMessageId + "->" + messageId, id, instanceId, ...message);
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

  authenticatedTask_async: async function (task, userId, groupsStore_async) {
    let authenticated = false;
    if (task?.permissions) {
      for (const group_name of task.permissions) {
        let group = await groupsStore_async.get(group_name);
        if (!group?.users) {
          console.log("Group " + group_name + " has no users");
        } else if (group.users.includes(userId)) {
          authenticated = true;
        }
      }
    } else {
      authenticated = true;
    }
    //console.log("Authenticated " + task.id + " " + userId + " " + authenticated);
    return authenticated;
  },

  getCallerFunctionDetails: function() {
    const stack = new Error().stack;
    const stackLines = stack.split('\n');
    if (stackLines[3]) {
      const match = stackLines[3].match(/at (.*) \(?(.*):(\d+):(\d+)\)?/);
      if (match) {
        return {
          functionName: match[1],
          filePath: match[2],
          lineNumber: match[3],
          columnNumber: match[4]
        };
      }
    }
    return null;
  },

  deepClone: function(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(utils.deepClone);
    }
    const clonedObj = {};
    // This will also clone properties
    for (const key in obj) {
      // eslint-disable-next-line no-prototype-builtins
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

  debugTask: async function(task, context = "") {
    /* eslint-disable no-unreachable */
    return;
    const callerDetails = this.getCallerFunctionDetails();
    const callerDetailsText = callerDetails ? callerDetails.filePath + ":" + callerDetails.lineNumber : "";
    const contextText = context + " " + callerDetailsText;
    let logParts = ["debugTask"];
    if (contextText) {
      logParts.push(contextText);
    }
    logParts.push(`id: ${task.id}`);
    logParts.push(`instanceId: ${task.instanceId}`);
    if (task?.meta?.messageId) {
      logParts.push(`messageId: ${task.meta.messageId}`);
    }
    console.log(logParts.join(' '));
  }

};

export { utils };