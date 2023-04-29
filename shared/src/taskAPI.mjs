/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/*
 The basic idea here is to wrap the Task object with get and set functions.
 Then it should be possible to version control the Task object
 Is there a language neutral way to do this?
*/


  const taskAPIversion = 0.0

  function pathRemapV00V01(path) {
    // Here we can refactor path
    return path
  }

  function pathRemapV01V00(path) {
    // Here we can refactor path
    return path
  }

  function getObjectValue(obj, path) {
    const keys = path.split('.');
    let value = obj;
    for (let key of keys) {
      //console.log("value",value, "key", key, "value[key]", value[key])
      value = value[key];
      if (value === undefined) {
        return undefined;
      }
    }
    return value;
  }

  function taskGet(task, path) {
    //console.log("taskGet ", path)
    if (!task) {
      return undefined
    }
    if (!task?.version) {
      const res = getObjectValue(task, path)
    } 
    if (task.version === 0.1 && taskAPIversion === 0.0) {
        path = pathRemapV00V01(path)
    }
    if (task.version === 0.1) {
        return getObjectValue(task, path)
    } else {
        console.error("Unknown Task version")
    }
  }

  function setValueByPath(obj, path, value) {
    const keys = path.split('.');
    let nestedObj = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in nestedObj)) {
        nestedObj[key] = {};
      }
      nestedObj = nestedObj[key];
    }
    nestedObj[keys[keys.length - 1]] = value;
  }

  function isLeaf(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return true;
    }
    for (const value of Object.values(obj)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return false;
      }
    }
    return true;
  }
  
  function remapObjectPaths(obj, pathRemapFn, keys = []) {
    const remappedObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKeys = keys.concat([key]);
      const remappedPath = pathRemapFn(newKeys.join("."));
      if (!isLeaf(value)) {
        const remappedNestedObj = remapObjectPaths(value, pathRemapFn, newKeys);
        setValueByPath(remappedObj, remappedPath, remappedNestedObj);
      } else {
        setValueByPath(remappedObj, remappedPath, value);
      }
    }
    return remappedObj;
  }  
  
  function taskMap(value) {
    let remappedObj
    if (typeof value !== 'function') {
      if (taskAPIversion === 0.0) {
        //remappedObj = value
        remappedObj = remapObjectPaths(value, pathRemapV01V00)
      }
    } else {
      // Remap from V0.1 to V0.0
      if (taskAPIversion === 0.0) {
        remappedObj = function(...args) {
          const result = value(...args);
          if (typeof result === 'object') {
            console.log("remapping ", result)
            const res = remapObjectPaths(result, pathRemapV01V00)
            //const res = result
            console.log("remappedObj ", res)
            return res
          } else {
            console.log("remappedObj not object")
          }
          return result;
        }
      }
    }
    console.log("taskMap ", remappedObj)
    return remappedObj
  }

export { taskGet, taskMap }
