/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";
import { v4 as uuidv4 } from "uuid";
import { deepMerge, checkConflicts, getObjectDifference, flattenObjects, updatedAt, parseRegexString, djb2Hash, taskHash } from "./shared/utils.mjs";

const utils = {};

utils.deepMerge = deepMerge;
utils.checkConflicts = checkConflicts;
utils.getObjectDifference = getObjectDifference;
utils.flattenObjects = flattenObjects;
utils.updatedAt = updatedAt;
utils.parseRegexString = parseRegexString;
utils.djb2Hash = djb2Hash;
utils.taskHash = taskHash;

utils.formatDateAndTime = function (date) {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  return new Intl.DateTimeFormat("fr-FR", options).format(date);
};

utils.load_data_async = async function (config_dir, name) {
  let result = {};
  try {
    result = (await import(config_dir + "/" + name + ".mjs"))[name];
    //console.log("Importing data " + config_dir + '/' + name + ".mjs ")
  } catch (error) {
    console.log(
      "No " + name + " at " + config_dir + "/" + name + ".mjs " + error
    );
  }
  return result;
};

utils.findSubObjectWithKeyValue = function (obj, targetKey, targetValue) {
  if (typeof obj !== "object" || obj === null) {
    return null;
  }
  if (obj[targetKey] === targetValue) {
    return obj;
  }
  for (const key in obj) {
    const result = utils.findSubObjectWithKeyValue(
      obj[key],
      targetKey,
      targetValue
    );
    if (result !== null) {
      return result;
    }
  }
  return null;
};

utils.regexProcessMessages_async = async function (
  messages,
  messageStore_async,
  initialLastMessageId = null
) {
  let lastMessageId = initialLastMessageId;

  for (const message of messages) {
    const id = uuidv4();
    const chatMessage = {
      role: message.role,
      user: message?.user,
      id: id,
      parentMessageId: lastMessageId,
      text: message.content,
    };

    if (message.role === "system") {
      error("Not expecting system message here");
    } else {
      await messageStore_async.set(id, chatMessage);
    }

    lastMessageId = id;
  }
  return lastMessageId;
};

utils.messagesText_async = async function (messageStore_async, LastMessageId) {
  let id = LastMessageId;
  let text = "";
  let message;
  while ((message = await messageStore_async.get(id))) {
    text = message.text + text; // prepend
    id = message.parentMessageId;
  }
  return text;
};

utils.capitalizeFirstLetter = function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

utils.getNestedValue = function (obj, path) {
  return path.split(".").reduce((prev, curr) => {
    return prev && prev[curr] !== undefined ? prev[curr] : undefined;
  }, obj);
};

utils.setNestedValue = function (obj, path, value) {
  const pathArray = path.split(".");
  const lastKey = pathArray.pop();
  const target = pathArray.reduce((prev, curr) => {
    return (prev[curr] = prev[curr] || {});
  }, obj);

  target[lastKey] = value;
};

utils.createTaskValueGetter = function(task) {
  return function (path, value) {
    if (arguments.length === 2) {
      utils.setNestedValue(task, path, value);
      //console.log("createTaskValueGetter set ", path, value)
    } else {
      const res = utils.getNestedValue(task, path);
      //console.log("createTaskValueGetter get ", path, res)
      return res;
    }
  };
};

// Adding key of object as id in object
utils.add_index = function(config) {
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      config[key]["id"] = key;
    }
  }
}

utils.createCEP = function(CEPFuncs, task, match, CEPFunc, args) {
  // Check if the Map has an entry for match
  if (!task.familyId) {
    console.log("task", task);
    throw new Error("task.familyId is undefined");
  }
  let origMatch = match;
  match =  match + task.familyId;
  let funcMap = CEPFuncs.get(match);
  if (!funcMap) {
    // If not, create a new Map for match
    funcMap = new Map();
    funcMap.set(task.instanceId, [CEPFunc, args]); // Will need to clean this up
    CEPFuncs.set(match, funcMap);
    console.log("CEPFuncs created function for " + origMatch + " from " + task.id + " familyId " + task.familyId);  
  } else {
    // Only add the function if there isn't already an entry for this task.instanceId
    if (!funcMap.has(task.instanceId)) {
      funcMap.set(task.instanceId, [CEPFunc, args]);
      CEPFuncs.set(match, funcMap);
      console.log("CEPFuncs added function for " + origMatch + " from " + task.id + " familyId " + task.familyId);
    }
  }
}

export { utils };
