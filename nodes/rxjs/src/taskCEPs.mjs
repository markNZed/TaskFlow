/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";

import { CEPFunctionMap } from "./storage.mjs";

function CEPregister(name, func) {
  if (name === undefined) {
    throw Error("CEPregister name is undefined");
  }
  console.log("nodeCEPs register", name);
  if (typeof func === "function") {
    CEPFunctionMap.set(name, func);
  }
}

function CEPget(name) {
  const func = CEPFunctionMap.get(name);
  if (typeof func === 'function') {
    return func;
  } else {
    console.log("Possible names:", CEPFunctionMap.keys());
    throw new Error('Invalid name ' + name);
  } 
}

function CEPCreate(CEPMatchMap, task, match, config) {
  console.log(`CEPCreate by ${task.instanceId} with config`, config)
  const name = config.CEPName || config.moduleName || config.name;
  if (name === undefined || name === null) {
    console.error("CEPCreate name is undefined/null", config);
    throw Error("CEPCreate name is undefined/null");
  }
  const args = config.args;
  const filter = config.filter; // intended for filtering tasks for match
  const CEPFunc = CEPget(name);
  if (match === undefined) {
    throw Error("CEPCreate match is undefined");
  }
  // Check if the Map has an entry for match
  let entryId = task.instanceId;
  if (config.isSingleton) {
    entryId = task.id;
  }
  const usingUserId = match.includes("userId-");
  const usingCEPSecret = match.includes("CEPSecret-");
  if (usingUserId) {
    if (!task.user?.id) {
      throw Error("User id is undefined");
    }
    match = task.user.id + "-" + match;
  // Singleton will not be distinct per family  
  } else if (usingCEPSecret) {
    // Nothing to do as match contains the secret
  } else if (!config.isSingleton && !config.isRegex) {
    match = task.familyId + "-" + match;
  }
  // maybe we should still prefix the fammilyId here except for system tasks
  if (config.isRegex) {
    match = "regex:" + match;
  }
  let funcMap = CEPMatchMap.get(match);
  if (!funcMap) {
    // If not, create a new Map for match
    funcMap = new Map();
    funcMap.set(entryId, [task.instanceId, CEPFunc, name, args, filter]); // Will need to clean this up from memory
    CEPMatchMap.set(match, funcMap); 
  } else {
    // Only add the function if there isn't already an entry for this entryId
    // Want to avoid adding system CEP every time the node registers
    if (!funcMap.has(entryId)) {
      funcMap.set(entryId, [task.instanceId, CEPFunc, name, args, filter]);
      CEPMatchMap.set(match, funcMap);
    }
  }
  console.log(`CEPMatchMap created entry ${entryId} name:${name} matching:${match}`);  
}

export { CEPregister, CEPget, CEPCreate };
