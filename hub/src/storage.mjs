/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import {} from "../config.mjs";
import syncTasks from "./syncTasks.mjs";
import Keyv from "keyv";
import KeyvBetterSqlite3 from "keyv-better-sqlite3";
import * as dotenv from "dotenv";
dotenv.config();

var connections = new Map(); // Stores WebSocket instances with unique session IDs
var activeProcessors = new Map();

// Each keyv store is in a different table
const DB_URI = "sqlite://db/main.sqlite";

// Allows for middleware
function newKeyV(uri, table, setCallback = null) {
  const keyv = new Keyv({
    store: new KeyvBetterSqlite3({
      uri: uri,
      table: table,
    }),
  });
  const originalSet = keyv.set.bind(keyv);
  keyv.set = async function(key, value, ttl) {
    // Middleware logic before setting the value
    if (typeof setCallback === 'function') {
      setCallback(key, value);
      //console.log("Setting table", table, "key", key, "value", value)
    }
    const result = await originalSet(key, value, ttl);
    return result;
  };
  return keyv;
};

// We could have one keyv store and use prefix for different tables

// Schema:
//   Key: sessionId || sessionId + 'userId'
//   Value: object
const sessionsStore_async = newKeyV(DB_URI, "sessions");
// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = newKeyV(DB_URI, "instances");
// Schema:
//   Key: threadId || taskId + userId || taskId + sessionId || taskId + groupId
//   Value: array of instanceId
const threadsStore_async = newKeyV(DB_URI, "threads");
// Schema:
//   Key: instanceId
//   Value: {task: {}, processorIds: []};
const activeTasksStore_async = newKeyV(DB_URI, "activeTasks", syncTasks);
// Schema:
//   Key: threadId + taskId
//   Value: {taskId : output}
const outputStore_async = newKeyV(DB_URI, "outputsStore_async");

export {
  sessionsStore_async,
  instancesStore_async,
  threadsStore_async,
  activeTasksStore_async,
  outputStore_async,
  connections,
  activeProcessors,
};
