import _ from "lodash";
import assert from 'assert';
import pkg from 'intl';
const { DateTimeFormat } = pkg;

// Without this we cannot make partial updates to objects in the Task

function deepMerge(prevState, update) {
  if (prevState === undefined) {
    return update;
  }

  if (update === undefined) {
    return prevState;
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
        const merge = deepMerge(prevState[i], update[i]);
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
    return output;
  }

  if (typeof update === "object") {
    //console.log("deepMerge object", update)
    let output = { ...prevState };
    for (const key in update) {
      // Null is treated as a deletion in the case of objects
      if (update[key] === null) {
        delete output[key];
      } else if (output[key] === undefined) {
        output[key] = update[key];
      } else if (typeof update[key] === "object" || Array.isArray(update[key])) {
        output[key] = deepMerge(output[key], update[key]);
      } else {
        output[key] = update[key];
      }
    }
    return output;
  }

  return update;
}

function deepCompare(obj1, obj2, visitedObjects = new WeakSet()) {
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
      if (!keys2.includes(key) || !deepCompare(obj1[key], obj2[key], visitedObjects)) {
        return false;
      }
    }

    return true;
  } else {
    // If inputs are not objects (or are null), use strict equality check
    return obj1 === obj2;
  }
}

function checkConflicts(obj1, obj2) {
  // Helper function to check if a value is an object
  const isObject = (value) => typeof value === 'object' && value !== null;

  let conflict = false;
  
  // Iterate over keys in obj1
  Object.keys(obj1).forEach(key => {
    if (obj2.hasOwnProperty(key)) {
      if (isObject(obj1[key]) && isObject(obj2[key])) {
        // Recursive check for nested objects
        if (checkConflicts(obj1[key], obj2[key])) {
          conflict = true;
        }
      } else if (obj1[key] !== obj2[key]) {
        // Conflict detected when values are different
        console.log("Conflict in merge: " + key + " " + JSON.stringify(obj1[key]) + " " + JSON.stringify(obj2[key]));
        conflict = true;
      }
    }
  });

  return conflict;
}

// This can return sparse arrays
// Would be better to return undefined if no difference?
function getObjectDifference(obj1, obj2) {

  if (_.isEqual(obj1, obj2)) {
    return Array.isArray(obj1) ? [] : {};
  }

  if (!_.isObject(obj2)) {
    return obj2;
  }

  let diffObj = Array.isArray(obj2) ? [] : {};

  _.each(obj2, (value, key) => {
    if (obj2[key] === null) {
      Array.isArray(diffObj) ? diffObj.push(null) : diffObj[key] = null;
    } else if (obj1[key] === null || obj1[key] === undefined) {
      Array.isArray(diffObj) ? diffObj.push(value) : diffObj[key] = value;
    } else {
      let diff = getObjectDifference(obj1[key], value);
      if (diff === null) {
        // Null treated as a placeholder in the case of arrays
        Array.isArray(diffObj) ? diffObj.push(null) : undefined;
      } else if (!_.isObject(diff) || (_.isObject(diff) && !_.isEmpty(diff))) {
        Array.isArray(diffObj) ? diffObj.push(diff) : diffObj[key] = diff;
      } else {
        Array.isArray(diffObj) ? diffObj.push(null) : undefined;
      }
    }
  });
  
  _.each(diffObj, (value, key) => {
    if (Array.isArray(value) && value.length === 0) {
      delete diffObj[key]
    } else if (_.isObject(value) && _.isEmpty(value)) {
      //console.log("getObjectDifference", "delete", key, value);
      delete diffObj[key]
    } else if (value === undefined) {
      delete diffObj[key]
    }
  });

  return diffObj; // copy to avoid issues if the return value is modified
}

// Flatten hierarchical object and merge keys into children
function flattenObjects(objs) {
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
        obj = deepMerge(parent, obj);
      }
    }
    parent2id[obj.name] = id
    res[id] = obj;
  });
  return res;
}

function updatedAt() {
  const currentDateTime = new Date();
  const utcDateTime = currentDateTime.toISOString();
  const data = {
    date: utcDateTime,
    timezone: "UTC"
  };
  return data;
}

export { deepMerge, deepCompare, checkConflicts, getObjectDifference, flattenObjects, updatedAt };