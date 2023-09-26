/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";
import { v4 as uuidv4 } from "uuid";
import { utils as sharedUtils } from "./shared/utils.mjs";

const utils = {

  ...sharedUtils, // merge the sharedUtils into the utils object

  formatDateAndTime: function (date) {
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    return new Intl.DateTimeFormat("fr-FR", options).format(date);
  },

  load_data_async: async function (config_dir, name) {
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
  },

  findSubObjectWithKeyValue: function (obj, targetKey, targetValue) {
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
  },

  regexProcessMessages_async: async function (
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
        throw Error("Not expecting system message here");
      } else {
        await messageStore_async.set(id, chatMessage);
      }

      lastMessageId = id;
    }
    return lastMessageId;
  },

  messagesText_async: async function (messageStore_async, LastMessageId) {
    let id = LastMessageId;
    let text = "";
    let message;
    while ((message = await messageStore_async.get(id))) {
      text = message.text + text; // prepend
      id = message.parentMessageId;
    }
    return text;
  },

  capitalizeFirstLetter: function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  createCEP: function(CEPMatchMap, CEPFunctions, task, match, config) {
    console.log("createCEP config", config)
    const functionName = config.functionName;
    const args = config.args;
    const CEPFunc = CEPFunctions.get(functionName);
    if (match === undefined) {
      throw Error("createCEP match is undefined");
    }
    // Check if the Map has an entry for match
    let origMatch = match;
    let instanceId = task.instanceId;
    if (task.id.startsWith("root.system.")) {
      instanceId = task.instanceId;
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
      funcMap.set(instanceId, [instanceId, CEPFunc, functionName, args]); // Will need to clean this up from memory
      CEPMatchMap.set(match, funcMap);
      console.log("CEPMatchMap created function for " + origMatch + " from match " + match);  
    } else {
      // Only add the function if there isn't already an entry for this instanceId
      // Want to avoid adding system CEP every time the processor registers
      if (!funcMap.has(instanceId)) {
        funcMap.set(instanceId, [instanceId, CEPFunc, functionName, args]);
        CEPMatchMap.set(match, funcMap);
        console.log("CEPMatchMap added function for " + origMatch + " from match " + match);
      }
    }
  },

};

export { utils };
