/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { COPROCESSOR, MONGO_URL, EMPTYDBS } from "../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import mongoose from 'mongoose';
import { newKeyV, redisClient } from "./shared/storage/redisKeyV.mjs";
import { processorId } from "../config.mjs";

var connections = new Map(); // Stores WebSocket instances with unique session IDs
var activeTaskFsm = new Map(); // Reference to the FSM if it is long running

mongoose.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', error => console.error('connection error:', error));
db.once('open', () => {
  console.log("Connected to MongoDB!");
});

if (EMPTYDBS) {
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
}

const coprocessorPrefix = COPROCESSOR ? "copro:" : "";
const keyvPrefix = processorId + ":" + coprocessorPrefix;

// Schema:
//   Key: hash
//   Value: object
const cacheStore_async = newKeyV(redisClient, keyvPrefix + "cache");
// Schema:
//   Key: instanceId
//   Value: task object
const activeTasksStore_async = newKeyV(redisClient, keyvPrefix + "activeTasks");
// Schema:
//   Key: task.id
//   Value: data object
const taskDataStore_async = newKeyV(redisClient, keyvPrefix + "taskData");

const sharedStore_async = newKeyV(redisClient, "shared"); // Shared with Hub

const tasksStore_async = newKeyV(redisClient, "tasks"); // Shared with Hub

const usersStore_async = newKeyV(redisClient, "users"); // Shared with Hub

const groupsStore_async = newKeyV(redisClient, "groups"); // Shared with Hub

const tasktypesStore_async = newKeyV(redisClient, "tasktypes"); // Shared with Hub

if (EMPTYDBS) {
  await Promise.all([
    cacheStore_async.clear(),
    activeTasksStore_async.clear(),
    taskDataStore_async.clear(),
    //tasksStore_async.clear(), We do not clear this because it is controlled by Hub
  ]);
  console.log("Empty DB: cleared all KeyV");
}

export {
  cacheStore_async,
  activeTasksStore_async,
  taskDataStore_async,
  connections,
  activeTaskFsm,
  db,
  tasksStore_async,
  usersStore_async,
  groupsStore_async,
  tasktypesStore_async,
  sharedStore_async,
};
