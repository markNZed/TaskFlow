/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import {} from "../config.mjs";
import Keyv from "keyv";
import KeyvBetterSqlite3 from "keyv-better-sqlite3";
import syncTasks_async from "./syncTasks.mjs";
import * as dotenv from "dotenv";
dotenv.config();

var connections = new Map(); // Stores WebSocket instances with unique session IDs

// Each keyv store is in a different table
const DB_URI = "sqlite://db/main.sqlite";

// Allows for middleware
// Passing the websocket to avoid circular imports
function newKeyV(uri, table, setCallback = null) {
  const keyv = new Keyv({
    store: new KeyvBetterSqlite3({
      uri: uri,
      table: table,
    }),
  });
  if (typeof setCallback === 'function') {
    const originalSet = keyv.set.bind(keyv);
    keyv.set = async function(wsSendTask, key, value, ttl) {
      // Middleware logic before setting the value
      //console.log("Setting table", table, "key", key, "value", value)
      setCallback(wsSendTask, keyv, key, value);
      const result = await originalSet(key, value, ttl);
      return result;
    };
  }
  return keyv;
};

// We could have one keyv store and use prefix for different tables

// Schema: See ChatGPTAPI
// For now this is a dedicated store but eventually it
// should be an interface to the threads + instances
const messagesStore_async = newKeyV(DB_URI, "messages");
// Schema:
//   Key: hash
//   Value: object
const cacheStore_async = newKeyV(DB_URI, "cache");
// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = newKeyV(DB_URI, "instances");
// Schema:
//   Key: instanceId
//   Value: task object
const activeTasksStore_async = newKeyV(DB_URI, "activeTasks", syncTasks_async);
// Schema:
//   Key: threadId || taskId + userId || taskId + sessionId || taskId + groupId
//   Value: array of instanceId
const threadsStore_async = newKeyV(DB_URI, "threads");

export {
  messagesStore_async,
  cacheStore_async,
  instancesStore_async,
  activeTasksStore_async,
  threadsStore_async,
  connections,
};
