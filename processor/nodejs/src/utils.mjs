/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";
import { v4 as uuidv4 } from "uuid";
import { deepMerge, checkConflicts, getObjectDifference, flattenObjects, updatedAtString } from "./shared/utils.mjs";

const utils = {};

utils.deepMerge = deepMerge;
utils.checkConflicts = checkConflicts;
utils.getObjectDifference = getObjectDifference;
utils.flattenObjects = flattenObjects;
utils.updatedAtString = updatedAtString;

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

utils.djb2Hash = function (str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // convert to unsigned 32-bit integer
};

utils.processMessages_async = async function (
  messages,
  messageStore_async,
  initialLastMessageId = null
) {
  let lastMessageId = initialLastMessageId;

  for (const message of messages) {
    const id = uuidv4();
    const chatMessage = {
      role: message.role,
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
      //console.log("createTaskValueGetter set ",path,value)
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


export { utils };
