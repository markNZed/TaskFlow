/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";
import { v4 as uuidv4 } from "uuid";
import { utils as sharedUtils } from "./shared/utils.mjs";

const utils = {
  
  ...sharedUtils,

  getSourceIP: function (req) {
    let sourceIP = req.ip;
    if (!sourceIP && req.socket) {
      sourceIP = req.socket.remoteAddress;
    }
    if (sourceIP && sourceIP.startsWith('::ffff:')) {
      sourceIP = sourceIP.substring('::ffff:'.length);
    } else {
      console.log("WARNING: Unknown source IP: " + req.ip, req);
    }
    return sourceIP;
  },

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
      //console.log("load_data_async importing data " + config_dir + '/' + name + ".mjs ")
    } catch (error) {
      console.log(
        "load_data_async no " + name + " at " + config_dir + "/" + name + ".mjs " + error
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
        content: message.content,
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

  // Set values to true to indicate key exists
  findKeys: function(task, ignore, path = '') {
    const newObject = {};
    Object.keys(task).forEach(key => {
      if (ignore.includes(path ? path + '.' + key : key)) {
        return;
      }
      if (typeof task[key] === 'object' && task[key] !== null) {
        newObject[key] = utils.findKeys(task[key], ignore, path ? path + '.' + key : key);
      } else {
        newObject[key] = true;
      }
    });
    if (Object.keys(newObject).length === 0) {
      return;
    }
    return newObject;
  },
  
  // If modified values are set (true) and object has all the keys of activeTask
  // then we can just set the branch to true (indicating all values below are modified)
  compactModified: function(activeTask, modified, compare = true, depth = 0) {
    if (activeTask === undefined || activeTask === null) {
      return true;
    }
    if (!modified) {
      return modified;
    }
    const activeTaskKeys = Object.keys(activeTask);
    const modifiedKeys = Object.keys(modified);
    // Start from the leaves of modified 
    let leaves = true;
    let deletedAll = true;
    if (typeof modified === 'object' && modified !== null) {
      for (const key of modifiedKeys) {
        if (typeof modified[key] === 'object') {
          leaves = false;
          deletedAll = false;
          break;
        } else {
          if (compare && modified[key] === activeTask[key]) {
            delete modified[key];
          } else {
            deletedAll = false;
          }
        }
      }
      if (deletedAll) {
        return false;
      }
    }
    let result = modified;
    if (leaves) {
      if (activeTaskKeys.length <= modifiedKeys.length) {
        result = true;
      }
    } else {
      let allTrue = true;
      deletedAll = true;
      for (const key of modifiedKeys) {
        modified[key] = utils.compactModified(activeTask[key], modified[key], compare, depth + 1);
        if (allTrue && modified[key] !== true) {
          allTrue = false;
          deletedAll = false;
        } else if (modified[key] === false) {
          delete modified[key];
        } else {
          deletedAll = false;
        }
      }
      if (allTrue && activeTaskKeys.length <= modifiedKeys.length) {
        result = true;
      } else if (deletedAll) {
        result = false;
      }
    }
    modified = result;
    return result;
  },

  // It would be more effective to build task.meta.modified in the compact form
  setMetaModified: function(activeTask, task) {
    const ignore = ["meta", "node", "user", "masks"];
    task.meta = task.meta || {};
    if (task.meta?.modified) {
      delete task.meta.modified;
    }
    if (task.node?.commandArgs?.syncTask) {
      if (task.node.commandArgs.syncTask?.meta?.modified) {
        delete task.node.commandArgs.syncTask.meta.modified;
      }
      task.node.commandArgs.syncTask["meta"] = task.node.commandArgs.syncTask.meta || {};
      //utils.logTask(task, "setMetaModified task.node.commandArgs.syncTask", utils.js(task.node.commandArgs.syncTask));
      task.node.commandArgs.syncTask.meta["modified"] = utils.findKeys(task.node.commandArgs.syncTask, ignore);
      //utils.logTask(task, "setMetaModified task.node.commandArgs.syncTask.meta.modified", utils.js(task.node.commandArgs.syncTask.meta.modified));
      if (task.node.commandArgs.syncTask.meta.modified) {
        utils.compactModified(activeTask, task.node.commandArgs.syncTask.meta.modified);
        //utils.logTask(task, "setMetaModified compactModified task.node.commandArgs.syncTask.meta.modified", utils.js(task.node.commandArgs.syncTask.meta.modified));
      }
    } else {
      task.meta["modified"] = utils.findKeys(task, ignore);
      if (task.meta.modified) {
        utils.compactModified(activeTask, task.meta.modified);
        //utils.logTask(task, "task.meta.modified", utils.js(task.meta.modified));
      }
    }
    return task;
  },

  setSyncEvents: function(activeTask, task) {
    const ignore = ["meta"];
    task.node.commandArgs.syncTask["meta"] = task.node.commandArgs.syncTask.meta || {};
    task.node.commandArgs.syncEvents = utils.findKeys(task.node.commandArgs.syncTask, ignore);
    if (task.node.commandArgs.syncEvents) {
      const compare = false;
      utils.compactModified(activeTask, task.node.commandArgs.syncEvents, compare);
    }
    return task;
  },

};

export { utils };
