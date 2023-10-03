/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";
import { v4 as uuidv4 } from "uuid";
import { MAP_USER, DEFAULT_USER } from "../config.mjs";
import { utils as sharedUtils } from "./shared/utils.mjs";

const utils = {
  
  ...sharedUtils,

  getUserId: function (req) {
    let userId = DEFAULT_USER;
    let sourceIP = req.ip;
    if (sourceIP.startsWith('::ffff:')) {
      sourceIP = sourceIP.substring('::ffff:'.length);
    }
    // If the request is from localhost then no need to authenticate
    if (sourceIP === "127.0.0.1") {
      if (req.body.userId) {
        userId = req.body.userId;
      }
    } else if (process.env.AUTHENTICATION === "basic") { // untested
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const encodedCredentials = authHeader.split(' ')[1];
        const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString();
        // eslint-disable-next-line no-unused-vars
        const [username, password] = decodedCredentials.split(':');
        userId = username;
      }
      //userId = req.headers["x-authenticated-userid"]; // unsure if this works
    } else if (process.env.AUTHENTICATION === "cloudflare") {
      userId = req.headers["cf-access-authenticated-user-email"];
    }
    if (MAP_USER && MAP_USER[userId]) {
      userId = MAP_USER[userId];
    }
    return userId;
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
  
  setMetaModified: function(task) {
    const ignore = ["meta", "node", "hub", "privacy", "id", "instanceId", "user.id"];
    task.meta = task.meta || {};
    if (task.node?.commandArgs?.syncTask) {
      task.node.commandArgs.syncTask["meta"] = task.node.commandArgs.syncTask.meta || {};
      task.node.commandArgs.syncTask.meta["modified"] = utils.findKeys(task.node.commandArgs.syncTask, ignore);
    }
    task.meta["modified"] = utils.findKeys(task, ignore);
    return task;
  },

};

export { utils };
