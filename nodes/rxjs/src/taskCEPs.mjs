/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";

import { CEPFunctionMap } from "./storage.mjs";

function CEPregister(functionName, func) {
  if (functionName === undefined) {
    throw Error("CEPregister functionName is undefined");
  }
  console.log("nodeCEPs register", functionName);
  if (typeof func === "function") {
    CEPFunctionMap.set(functionName, func);
  }
}

function CEPget(funcName) {
  const func = CEPFunctionMap.get(funcName);
  if (typeof func === 'function') {
      return func;
  } else {
      throw new Error('Invalid function name ' + funcName);
  } 
}

function CEPCreate(CEPMatchMap, CEPFunctionMap, task, match, config) {
  console.log(`CEPCreate by ${task.instanceId} with config`, config)
  const functionName = config.functionName;
  if (functionName === undefined) {
    console.error("CEPCreate functionName is undefined", config);
    throw Error("CEPCreate functionName is undefined");
  }
  const args = config.args;
  const CEPFunc = CEPget(functionName);
  if (match === undefined) {
    throw Error("CEPCreate match is undefined");
  }
  // Check if the Map has an entry for match
  let entryId = task.instanceId;
  if (task.id.startsWith("root.system.")) {
    entryId = task.id;
  }
  if (!task.id.startsWith("root.system.") || !config.isRegex) {
    match = task.familyId + "-" + match;
  }
  if (config.isRegex) {
    match = "regex:" + match;
  }
  let funcMap = CEPMatchMap.get(match);
  if (!funcMap) {
    // If not, create a new Map for match
    funcMap = new Map();
    funcMap.set(entryId, [task.instanceId, CEPFunc, functionName, args]); // Will need to clean this up from memory
    CEPMatchMap.set(match, funcMap); 
  } else {
    // Only add the function if there isn't already an entry for this entryId
    // Want to avoid adding system CEP every time the processor registers
    if (!funcMap.has(entryId)) {
      funcMap.set(entryId, [task.instanceId, CEPFunc, functionName, args]);
      CEPMatchMap.set(match, funcMap);
    }
  }
  console.log(`CEPMatchMap created entry ${entryId} function:${functionName} matching:${match}`);  
}

export { CEPregister, CEPget, CEPCreate };
