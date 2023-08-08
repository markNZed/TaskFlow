import _ from "lodash";
import assert from 'assert';
import pkg from 'intl';
const { DateTimeFormat } = pkg;

// Without this we cannot make partial updates to objects in the Task

const sharedUtils = {

  deepMergeProcessor: function(prevState, update, processorIn) {
    const processor = JSON.parse(JSON.stringify(processorIn));
    let result = sharedUtils.deepMerge(prevState, update);
    result.processor = processor;
    //sharedUtils.removeNullKeys(result);
    return result;
  },

  deepMergeHub: function(prevState, update, hubIn) {
    const hub = JSON.parse(JSON.stringify(hubIn));
    let result = sharedUtils.deepMerge(prevState, update);
    result.hub = hub;
    //sharedUtils.removeNullKeys(result);
    return result;
  },

  deepMerge: function(prevState, update) {
    if (prevState === undefined) {
      return update;
    }

    if (update === undefined) {
      return prevState;
    }

    if (_.isEmpty(update) || _.isEmpty(update)) {
      return update;
    }

    if (Array.isArray(update)) {
      //console.log("deepMerge array", prevState, update)
      let output = [];
      const maxLength = update.length;
    
      for (let i = 0; i < maxLength; i++) {
        // Null is treated as a placeholder in the case of arrays
        if (!prevState || i >= prevState.length) {
          //console.log("deepMerge length", prevState[i]);
          output.push(update[i]);
        } else if (update[i] === null) {
          //console.log("deepMerge null", prevState[i]);
          output.push(prevState[i]);
        } else if (typeof update[i] === "object" || Array.isArray(update[i])) {
          const merge = sharedUtils.deepMerge(prevState[i], update[i]);
          //console.log("deepMerge merge", merge);
          if (merge === null) {
            output.push(prevState[i]);
          } else {
            output.push(merge);
          }
        } else {
          //console.log("deepMerge other", update[i]);
          output.push(update[i]);
        }
      }

      if (prevState.length > update.length) {
        output.push(...prevState.slice(update.length));
      }

      return output;
    }

    if (typeof update === "object") {
      //console.log("deepMerge object", update)
      let output = { ...prevState };
      for (const key in update) {
        // Null is treated as a deletion in the case of objects
        if (update[key] === null) {
          output[key] = null;
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
          output[key] = sharedUtils.deepMerge(output[key], update[key]);
        } else {
          output[key] = update[key];
        }
      }
      return output;
    }

    return update;
  },

  deepCompare: function(obj1, obj2, visitedObjects = new WeakSet()) {
    // Check if objects are cyclic
    if (visitedObjects.has(obj1) || visitedObjects.has(obj2)) {
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
        return false;
      }

      // Recursively compare each property
      for (let key of keys1) {
        if (!keys2.includes(key) || !sharedUtils.deepCompare(obj1[key], obj2[key], visitedObjects)) {
          return false;
        }
      }

      return true;
    } else {
      // If inputs are not objects (or are null), use strict equality check
      return obj1 === obj2;
    }
  },

  /*
  In this updated function, we've added an isArray helper function that uses Array.isArray to check if a value is an array. We then use this function in our check for whether the values at a key in both objects are objects. If they are arrays, we iterate over their elements and check for conflicts, but ignore any elements that are null in either array. If the lengths of the arrays are different, we still consider that a conflict, as it's a structural difference between the two objects.
  */
  checkConflicts: function(obj1, obj2, path = "") {
    // Helper functions
    const isObject = (value) => typeof value === 'object' && value !== null;
    const isArray = (value) => Array.isArray(value);

    let conflict = false;

    // Iterate over keys in obj1
    Object.keys(obj1).forEach(key => {
      if (obj2.hasOwnProperty(key)) {
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
            if (sharedUtils.checkConflicts(obj1[key], obj2[key], path + "." + key)) {
              conflict = true;
            }
          }
        } else if (obj1[key] !== obj2[key]) {
          // Conflict detected when values are different
          console.log("Conflict in merge: " + path + "." + key + " " + JSON.stringify(obj1[key]) + " " + JSON.stringify(obj2[key]));
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
  getObjectDifference: function(obj1, obj2) {

    if (obj1 === obj2 || _.isEqual(obj1, obj2)) { // deep comparison
      return undefined;
    }

    if (!_.isObject(obj2) || _.isEmpty(obj2) || obj1 === undefined) {
      return obj2;
    }

    // obj2 is an object
    if (!_.isObject(obj1)) {
      return obj2;
    }

    let diffObj = Array.isArray(obj2) ? [] : {};

    _.each(obj2, (value, key) => {
      let diff = sharedUtils.getObjectDifference(obj1[key], value);
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

    if (_.isEmpty(diffObj)) {
      diffObj = undefined;
    }

    return diffObj; // copy to avoid issues if the return value is modified
  },

  getIntersectionWithDifferentValues: function(obj1, obj2) {
    if (_.isEqual(obj1, obj2)) {
      return Array.isArray(obj1) ? [] : {};
    }
  
    if (!_.isObject(obj1) || !_.isObject(obj2)) {
      return null;
    }
  
    let diffObj = Array.isArray(obj1) && Array.isArray(obj2) ? [] : {};
  
    _.each(obj1, (value, key) => {
      if (obj2.hasOwnProperty(key)) {
        if (_.isObject(value) && _.isObject(obj2[key])) {
          let diff = sharedUtils.getIntersectionWithDifferentValues(value, obj2[key]);
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
          obj = sharedUtils.deepMerge(parent, obj);
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
        return obj.map(sharedUtils.taskHashSortKeys);
    }
    // Object, sort keys
    return Object.keys(obj)
        .sort()
        .reduce((result, key) => {
            // Recursively sort keys in the object
            result[key] = sharedUtils.taskHashSortKeys(obj[key]);
            return result;
        }, {});
  },

  taskHash: function(task) {
    if (!task) {
      return 0;
    }
    // Only hash information that is shared between all processors and hub
    let taskCopy = JSON.parse(JSON.stringify(task));
    taskCopy = sharedUtils.cleanForHash(taskCopy);
    const sortedObj = sharedUtils.taskHashSortKeys(taskCopy);
    const hash = sharedUtils.djb2Hash(JSON.stringify(sortedObj));
    //console.log("HASH VALUE", hash);
    return hash;
  },

  removeNullKeys: function(obj) {
    // Base case: if the input isn't an object, return it as is
    if (typeof obj !== 'object' || obj === null) return obj;

    // Iterate over the object's keys
    for (let key in obj) {
        // If the current key's value is null, delete the key
        if (obj[key] === null) {
            delete obj[key];
        }
        // Otherwise, if it's an object or array, recursively call removeNullKeys on it
        else if (typeof obj[key] === 'object') {
            obj[key] = sharedUtils.removeNullKeys(obj[key]);
        }
    }
    return obj;
  },

  processorActiveTasksStoreSet_async: async function(activeTasksStore_async, task) {
    task.meta["hash"] = sharedUtils.taskHash(task);
    delete task.processor.origTask; // delete so we do not have ans old copy in origTask
    task.processor["origTask"] = JSON.parse(JSON.stringify(task)); // deep copy to avoid self-reference
    //sharedUtils.removeNullKeys(task);
    await activeTasksStore_async.set(task.instanceId, task);
    return task;
  },

  hubActiveTasksStoreSet_async: async function(activeTasksStore_async, task) {
    task.meta["hash"] = sharedUtils.taskHash(task);
    delete task.hub.origTask; // delete so we do not have an old copy in origTask
    // deep copy to avoid self-reference
    task.hub["origTask"] = JSON.parse(JSON.stringify(task)); 
    //sharedUtils.removeNullKeys(task);
    // If there is no type then this is a start request do we do not store it
    if (task.type) {
      await activeTasksStore_async.set(task.instanceId, task);
    } else {
      console.log("WARNING: hubActiveTasksStoreSet_async called with no type", task.id);
    }
    return task;
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
    return taskCopy;
  },

  processorDiff: function(task) {
    if (task.processor.command === "ping") {
      return task;
    }
    const taskCopy = JSON.parse(JSON.stringify(task)); // Avoid modifyng object that was passed in
    const origTask = taskCopy.processor.origTask;
    //console.log("processorDiff in origTask.output, task.output", origTask?.output, task.output);
    const diffTask = sharedUtils.getObjectDifference(origTask, taskCopy) || {};
    //console.log("sharedUtils.getObjectDifference(origTask, taskCopy)", origTask, taskCopy);
    // Which properties of the origTask differ from the task
    let diffOrigTask = sharedUtils.getIntersectionWithDifferentValues(origTask, taskCopy);
    if (diffOrigTask === null) {
      diffOrigTask = {};
    }
    diffOrigTask = sharedUtils.cleanForHash(diffOrigTask);
    //console.log("diffOrigTask", diffOrigTask, origTask, taskCopy);
    if (!diffTask.meta) {
      diffTask.meta = {};
    }
    diffTask.meta["hash"] = taskCopy?.meta?.hash;
    // Allows us to check only the relevant part of the origTask
    // More specific than testing for the hash of the entire origTask
    diffTask.meta["hashDiff"] = sharedUtils.taskHash(diffOrigTask);
    const hashDebug = true;
    if (hashDebug || taskCopy.meta.hashDebug) {
      diffTask.meta["hashDiffOrigTask"] = JSON.parse(JSON.stringify(diffOrigTask));
      diffTask.meta.hashDiffOrigTask = sharedUtils.cleanForHash(diffTask.meta.hashDiffOrigTask);
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
    //console.log("hubDiff origTask.request, task.request", origTask.request, task.request);
    const taskCopy = JSON.parse(JSON.stringify(task)) // Avoid modifyng object that was passed in
    const diffTask = sharedUtils.getObjectDifference(origTask, taskCopy) || {};
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
      let diffOrigTask = sharedUtils.getIntersectionWithDifferentValues(origTask, taskCopy);
      diffOrigTask = sharedUtils.cleanForHash(diffOrigTask);
      if (diffOrigTask === null) {
        diffOrigTask = {};
      }
      // Allows us to check only the relevant part of the origTask
      // More specific than testing for the hash of the entire origTask
      diffTask.meta["hashDiff"] = sharedUtils.taskHash(diffOrigTask);
      // In theory we could enable the hash debug in the task
      const hashDebug = true;
      if (hashDebug || taskCopy.meta.hashDebug) {
        diffTask.meta["hashTask"] = JSON.parse(JSON.stringify(origTask));
        diffTask.meta.hashTask = sharedUtils.cleanForHash(diffTask.meta.hashTask);
        diffTask.meta["hashDiffOrigTask"] = JSON.parse(JSON.stringify(diffOrigTask));
        diffTask.meta.hashDiffOrigTask = sharedUtils.cleanForHash(diffTask.meta.hashDiffOrigTask);
      }
      delete diffTask.hub.origTask; // Only used internally
    }
    //console.log("hubDiff diffTask.request", diffTask.request);
    return diffTask;
  },

  checkHashDiff: function(origTask, task) {
    const taskCopy = JSON.parse(JSON.stringify(task));
    const expectedHash = task.meta.hashDiff;
    let diffOrigTask = sharedUtils.getIntersectionWithDifferentValues(origTask, taskCopy);
    if (diffOrigTask === undefined) {
      diffOrigTask = {};
    }
    const localHash = sharedUtils.taskHash(diffOrigTask);
    if (expectedHash !== localHash) {
      if (task.meta.hashDiffOrigTask) {
        //console.error("Remote hashDiffOrigTask", task.meta.hashDiffOrigTask);
        let hashDiff = sharedUtils.getObjectDifference(origTask, task.meta.hashDiffOrigTask) || {};
        hashDiff = sharedUtils.cleanForHash(hashDiff);
        console.error("checkHashDiff hashDiff from remote", hashDiff);
      }
      diffOrigTask = sharedUtils.cleanForHash(diffOrigTask);
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
    const hashOrigTask = origTask.meta.hash;
    const hashUpdatedTask = updatedTask.meta.hash;
    if (hashOrigTask !== hashUpdatedTask) {
      console.error("ERROR: Task hash does not match", hashOrigTask, hashUpdatedTask);
      if (updatedTask.meta.hashTask) {
        let hashDiff;
        //console.error("Task hash does not match in update local:" + hashOrigTask + " remote:" + hashUpdatedTask); //, origTask, updatedTask.meta.hashTask);
        hashDiff = sharedUtils.getObjectDifference(updatedTask.meta.hashTask, origTask) || {};
        hashDiff = sharedUtils.cleanForHash(hashDiff);
        console.error("Task hashDiff of origTask", hashDiff);
        hashDiff = sharedUtils.getObjectDifference(origTask, updatedTask.meta.hashTask) || {};
        hashDiff = sharedUtils.cleanForHash(hashDiff);
        console.error("Task hashDiff of hashTask", hashDiff);
      }
      return false;
    }
    //return true;
    return sharedUtils.checkHashDiff(origTask, updatedTask);
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
    }
    delete task.commandArgs
    task.processor["id"] = processorId;
    let diffTask = sharedUtils.processorDiff(task);
    //console.log("taskInProcessorOut diffTask task.output", task.output);
    // Send the diff considering the latest task storage state
    if (diffTask.instanceId) {
      const lastTask = await activeTasksStore_async.get(diffTask.instanceId);
      if (lastTask && lastTask.meta.hash !== diffTask.meta.hash) {
        delete diffTask.processor.origTask; // delete so we do not have ans old copy in origTask
        diffTask.processor["origTask"] = JSON.parse(JSON.stringify(lastTask));
        diffTask = sharedUtils.processorDiff(diffTask);
        //console.log("taskInProcessorOut_async latest task storage task.output", diffTask.output);
      } else {
        //console.log("taskInProcessorOut lastTask.id, lastTask.meta.hash, diffTask.meta.hash", lastTask.id, lastTask.meta.hash, diffTask.meta.hash);
      }
    } else {
      //console.log("taskInProcessorOut_async no diffTask.instanceId");
    }
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
    task.processor["commandArgs"] = hub.commandArgs;
    task.processor = sharedUtils.deepMerge(task.processor, hub);
    if (hub.sourceProcessorId) {
      task.processor["sourceProcessorId"] = hub.sourceProcessorId;
    } else {
      delete task.processor.sourceProcessorId;
    }
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

};

export { sharedUtils };