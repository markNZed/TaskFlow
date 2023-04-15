'use strict';
import { v4 as uuidv4 } from 'uuid'

const utils = {};

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

utils.findObjectById = (data, targetId) => {
    if (Array.isArray(data)) {
      for (let item of data) {
        const result = utils.findObjectById(item, targetId);
        if (result) {
          return result;
        }
      }
    } else if (typeof data === 'object') {
      if (data.id === targetId) {
        return data;
      }
      for (let key in data) {
        if (data.hasOwnProperty(key)) {
          const result = utils.findObjectById(data[key], targetId);
          if (result) {
            return result;
          }
        }
      }
    }
    return null;
};
  
utils.ignoreByRegexList = function(obj, userId, regexList) {
    if (Array.isArray(obj)) {
      return obj.map(item => {
        if (typeof item === "object" && item !== null) {
          return utils.ignoreByRegexList(item, userId, regexList);
        } else {
          return item;
        }
      });
    }
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (acc === null) {
        return null
      } else if (key === "users" && !value.includes(userId)) {
        return null;
      } else if (!regexList.some(regex => regex.test(key))) {
        if (typeof value === "object" && value !== null) {
          acc[key] = utils.ignoreByRegexList(value, userId, regexList);
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {});
  }
  
export { utils };