/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import {} from "../config.mjs";
import Keyv from "keyv";
import KeyvBetterSqlite3 from "keyv-better-sqlite3";
import * as dotenv from "dotenv";
dotenv.config();

var connections = new Map(); // Stores WebSocket instances with unique session IDs
var activeProcessors = new Map();

// This extends KeyvBetterSqlite3 to allow for iteration
// I was using it but then refactored it out.
// Still seems like a good idea to keep it around.
class ExtendedKeyvBetterSqlite3 extends KeyvBetterSqlite3 {
  async *iterate() {
    const selectAllQuery = this.entry.select().toString();
    const rows = this.db.prepare(selectAllQuery).all();
    for (const row of rows) {
      const key = row.key.startsWith('keyv:') ? row.key.substring(5) : row.key;
      const value = JSON.parse(row.value).value;
      yield { key, value };
    }
  }
}

// Each keyv store is in a different table
const DB_URI = "sqlite://db/main.sqlite";

// Allows for middleware intercepting set calls to the DB
// This is not great for debug because we can lose the call stack for debug
// Currently not using it
function newKeyV(uri, table, setCallback = null) {
  const store = new ExtendedKeyvBetterSqlite3({
    uri: uri,
    table: table,
  });
  const keyv = new Keyv({ store });
  const originalSet = keyv.set.bind(keyv);
  keyv.set = async function(key, value, ttl) {
    // Middleware logic before setting the value
    if (typeof setCallback === 'function') {
      value = await setCallback(key, value);
      //console.log("Setting table", table, "key", key, "value", value)
    }
    let result = null;
    if (value !== null) {
      result = await originalSet(key, value, ttl);
    }
    return result;
  };
  // Creating an alias for the getAll method
  keyv.iterate = store.iterate.bind(store)
  return keyv;
};

function logActiveTasksStore(key, value) {
  console.log("activeTasksStore_async.set", key);
  return value;
}

// We could have one keyv store and use prefix for different tables

// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = newKeyV(DB_URI, "instances");
// Schema:
//   Key: familyId || taskId + userId || taskId + groupId
//   Value: array of instanceId
const familyStore_async = newKeyV(DB_URI, "threads");
// Schema:
//   Key: instanceId
//   Value: task object
//const activeTasksStore_async = newKeyV(DB_URI, "activeTasks", logActiveTasksStore);
const activeTasksStore_async = newKeyV(DB_URI, "activeTasks");
// Schema:
//   Key: instanceId
//   Value: array of processorIds
const activeTaskProcessorsStore_async = newKeyV(DB_URI, "activeTaskProcessors");
// Schema:
//   Key: processorId
//   Value: array of instanceIds
const activeProcessorTasksStore_async = newKeyV(DB_URI, "activeProcessorTasks");
// Schema:
//   Key: familyId
//   Value: {taskId : output}
const outputStore_async = newKeyV(DB_URI, "outputsStore_async");

export {
  instancesStore_async,
  familyStore_async,
  activeTasksStore_async,
  activeTaskProcessorsStore_async,
  activeProcessorTasksStore_async,
  activeProcessors,
  outputStore_async,
  connections,
};
