/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

'use strict';
import { v4 as uuidv4 } from 'uuid'
import Keyv from 'keyv'
import KeyvBetterSqlite3 from 'keyv-better-sqlite3';
import { MAP_USER, DEFAULT_USER } from './../config.mjs';

const utils = {};

utils.getUserId = function(req) {
  let userId = DEFAULT_USER
  if (process.env.AUTHENTICATION === "cloudflare") {
    userId = req.headers['cf-access-authenticated-user-email'];
  }
  if (MAP_USER && MAP_USER[userId]) {
    userId = MAP_USER[userId]
  }
  return userId
}

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
      //console.log("Importing data " + config_dir + '/' + name + ".mjs ")
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

utils.filter_in_list = function(task, filter_list) {
  const taskCopy = { ...task }; // or const objCopy = Object.assign({}, obj);
  for (const key in taskCopy) {
    if (!filter_list.includes(key)) {
      delete taskCopy[key];
    }
  }
  return taskCopy
}

utils.filter_in = function(components, tasks, task) {
  if (!task?.id) {
    console.log("ERROR Task has no id ", task)
  }
  //console.log("BEFORE ", task)
  let filter_list = []
  let filter_for_server = []
  // This assumes the components are not expanded - need to do this in dataconfig
  for (const c of task.stack) {
    filter_list = filter_list.concat(components['root.' + c].filter_for_client)
    filter_for_server = filter_list.concat(components['root.' + c].filter_for_server)
  }
  if (task?.filter_for_client) {
    filter_list = filter_list.concat(task.filter_for_client)
    filter_for_server = filter_for_server.concat(task.filter_for_server)
  }
  filter_list = Array.from(new Set(filter_list)) // uniquify
  filter_for_server = Array.from(new Set(filter_for_server)) // uniquify
  if (filter_list.length < 1) {
    console.log("Warning: the task ", task,  " is missing filter")
  }
  const taskCopy = { ...task }; // or const objCopy = Object.assign({}, obj);
  for (const key in taskCopy) {
    if (!filter_list.includes(key)) {
      delete taskCopy[key];
      if (!filter_for_server.includes(key) && !key.startsWith('APPEND_') && !key.startsWith('PREPEND_')) {
        console.log("Warning: Unknown task key not returned to client " + key + " in task id " + task.id)
      }
    }
  }
  //console.log("AFTER ", filter_list, taskCopy)
  return taskCopy
}

utils.authenticatedTask = function(task, userId, groups) {
  let authenticated = false
  if (task?.permissions) {
    task.permissions.forEach((group_name) => {
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

utils.getNestedValue = function(obj, path) {
  return path.split('.').reduce((prev, curr) => {
    return prev && prev[curr] !== undefined ? prev[curr] : undefined;
  }, obj);
}

utils.setNestedValue = function(obj, path, value) {
  const pathArray = path.split('.');
  const lastKey = pathArray.pop();
  const target = pathArray.reduce((prev, curr) => {
    return prev[curr] = prev[curr] || {};
  }, obj);

  target[lastKey] = value;
}

utils.createTaskValueGetter = function(task) {
  return function(path, value) {
    if (arguments.length === 2) {
      utils.setNestedValue(task, path, value)
      //console.log("createTaskValueGetter set ",path,value)
    } else {
      const res = utils.getNestedValue(task, path)
      //console.log("createTaskValueGetter get ", path, res)
      return res
    }
  };
}
  
export { utils };