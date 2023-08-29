/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { COPROCESSOR } from "../config.mjs";
import Keyv from "keyv";
import KeyvBetterSqlite3 from "keyv-better-sqlite3";
import * as dotenv from "dotenv";
dotenv.config();
import mongoose from 'mongoose';

var connections = new Map(); // Stores WebSocket instances with unique session IDs
var activeTaskFsm = new Map(); // Reference to the FSM if it is long running

// Each keyv store is in a different table
const DB_URI = COPROCESSOR ? "sqlite://db/main-copro.sqlite" : "sqlite://db/main.sqlite";

// use database "taskflow"
const mongoURL = "mongodb://user:pass@mongodb:27017/taskflow?authSource=admin";

mongoose.connect(mongoURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', error => console.error('connection error:', error));
db.once('open', () => {
  console.log("Connected to MongoDB!");
});

db.once('open', async () => {
  try {
      const collections = Object.keys(mongoose.connection.collections);
      for (const collectionName of collections) {
          const collection = mongoose.connection.collections[collectionName];
          await collection.drop();
          console.log(`Dropped ${collectionName} collection successfully!`);
      }
  } catch (err) {
      if (err.message !== 'ns not found') { // Ignore if the collection is not found
          console.error('Error dropping collection:', err);
      }
  }
});

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
}

// We could have one keyv store and use prefix for different tables

// Schema:
//   Key: hash
//   Value: object
const cacheStore_async = newKeyV(DB_URI, "cache");
// Schema:
//   Key: instanceId
//   Value: task object
const activeTasksStore_async = newKeyV(DB_URI, "activeTasks");
// Schema:
//   Key: task.id
//   Value: data object
const taskDataStore_async = newKeyV(DB_URI, "taskData");

export {
  cacheStore_async,
  activeTasksStore_async,
  taskDataStore_async,
  connections,
  activeTaskFsm,
  db,
};
