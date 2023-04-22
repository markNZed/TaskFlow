/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

'use strict';
import { v4 as uuidv4 } from 'uuid'
import Keyv from 'keyv'
import KeyvBetterSqlite3 from 'keyv-better-sqlite3';
import {  } from './../config.mjs';

const utils = {};

utils.newKeyV = function(uri, table) {
  return new Keyv({
    store: new KeyvBetterSqlite3({
      uri: uri,
      table: table,
    }),
  });
}

utils.fail = function(msg) {
  console.error(msg)
  exit
  process.exit(1)
}

utils.formatDateAndTime = function(date) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('fr-FR', options).format(date);
}

utils.load_data_async = async function(config_dir, name) {
    let result = {}
    try {
      result = (await import(config_dir + '/' + name + ".mjs"))[name];
    } catch (error) {
      console.log("No " + name + " at " + config_dir + '/' + name + ".mjs " + error);
    }
    return result
}

utils.findSubObjectWithKeyValue = function(obj, targetKey, targetValue) {
    if (typeof obj !== 'object' || obj === null) {
      return null;
    }
    if (obj[targetKey] === targetValue) {
      return obj;
    }
    for (const key in obj) {
      const result = utils.findSubObjectWithKeyValue(obj[key], targetKey, targetValue);
      if (result !== null) {
        return result;
      }
    }
    return null;
}
  
utils.djb2Hash = function(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // convert to unsigned 32-bit integer
}

utils.processMessages_async = async function(messages, messageStore_async, initialLastMessageId = null) {
    let lastMessageId = initialLastMessageId;
  
    for (const message of messages) {
      const id = uuidv4();
      const chatMessage = {
        role: message.role,
        id: id,
        parentMessageId: lastMessageId,
        text: message.content
      };
  
      if (message.role === "system") {
        error("Not expecting system message here");
      } else {
        await messageStore_async.set(id, chatMessage)
      }
      
      lastMessageId = id;
    }
    return lastMessageId;
}
  
utils.messagesText_async = async function(messageStore_async, LastMessageId) {
    let id = LastMessageId;
    let text = ''
    let message
    while (message = await messageStore_async.get(id)) {
      text = message.text + text // prepend
      id = message.parentMessageId
    }
    return text
}

utils.filter_in = function(task, filter_list) {
  const taskCopy = { ...task }; // or const objCopy = Object.assign({}, obj);
  for (const key in taskCopy) {
    if (!filter_list.includes(key)) {
      delete taskCopy[key];
    }
  }
  return taskCopy
}

utils.filter_out = function(tasks, task) {
  let component
  if (task.id.startsWith("root.ui.")) {
    component = task.id
  } else {
    component = "root.ui." + task.component + ".start"
  }
  const filter_list = tasks[component].filter_for_client
  if (!filter_list) {
    console.log("Warning: the task ", task,  " is missing filter")
  }
  const taskCopy = { ...task }; // or const objCopy = Object.assign({}, obj);
  for (const key in taskCopy) {
    if (!filter_list.includes(key)) {
      delete taskCopy[key];
    }
  }
  return taskCopy
}

utils.authenticatedTask = function(task, userId, groups) {
  let authenticated = false
  if (task?.groups) {
    task.groups.forEach((group_name) => {
      if (!groups[group_name]) {
        console.log("Warning: could not find group " + group_name )
      } else {
        if (groups[group_name].users.includes(userId)) {
          authenticated = true
        }
      }
    });
  } else {
    authenticated = true
  }
  return authenticated
}

utils.capitalizeFirstLetter = function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
  
export { utils };