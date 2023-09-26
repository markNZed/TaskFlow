/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { NODE } from "../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import mongoose from 'mongoose';
import { newKeyV, redisClient } from "./shared/storage/redisKeyV.mjs";
import { utils } from "./utils.mjs";

var connections = new Map(); // Stores WebSocket instances with unique session IDs
var activeTaskFsm = new Map(); // Reference to the FSM if it is long running

var CEPsMap = new Map();
var ServicesMap = new Map();
var OperatorsMap = new Map();

var CEPMatchMap = new Map();

mongoose.connect(NODE.storage.mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', error => console.error('connection error:', error));
db.once('open', () => {
  console.log("Connected to MongoDB!");
});

if (NODE.storage.emptyAllDb) {
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

const coprocessorPrefix = NODE.role === "coprocessor" ? "copro:" : "";
const keyvPrefix = NODE.id + ":" + coprocessorPrefix;

// Schema:
//   Key: hash
//   Value: object
const cacheStore_async = newKeyV(redisClient, keyvPrefix + "cache");
// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = newKeyV(redisClient, keyvPrefix + "instances");
// Schema:
//   Key: instanceId
//   Value: task object
const activeTasksStore_async = newKeyV(redisClient, keyvPrefix + "activeTasks");
// Schema:
//   Key: task.id
//   Value: data object
const taskDataStore_async = newKeyV(redisClient, keyvPrefix + "taskData");

const cepTypes_async = newKeyV(redisClient, keyvPrefix + "cepTypes");

const serviceTypes_async = newKeyV(redisClient, keyvPrefix + "serviceTypes");

const operatorTypes_async = newKeyV(redisClient, keyvPrefix + "operatorTypes");

const sharedStore_async = newKeyV(redisClient, "shared"); // Shared with Hub

const tasksStore_async = newKeyV(redisClient, "tasks"); // Shared with Hub

const usersStore_async = newKeyV(redisClient, "users"); // Shared with Hub

const groupsStore_async = newKeyV(redisClient, "groups"); // Shared with Hub

const tasktypesStore_async = newKeyV(redisClient, "tasktypes"); // Shared with Hub

async function getActiveTask_async(instanceId) {
  if (await activeTasksStore_async.has(instanceId)) {
    let task = await instancesStore_async.get(instanceId);
    return task;
  } else {
    console.log("Returned undefined from getActiveTask_async for instanceId:", instanceId);
    return undefined;
  }
}
async function setActiveTask_async(task) {
  utils.assert(task.instanceId !== undefined, JSON.stringify(task));
  await Promise.all([
    instancesStore_async.set(task.instanceId, task),
    activeTasksStore_async.set(task.instanceId, true)
  ]);
}

if (NODE.storage.emptyAllDb) {
  let toClear = [
    cacheStore_async.clear(),
    taskDataStore_async.clear(),
    cepTypes_async.clear(),
    serviceTypes_async.clear(),
    operatorTypes_async.clear(),
  ];
  if (NODE.role !== "coprocessor") {
    toClear.push(activeTasksStore_async.clear());
    toClear.push(instancesStore_async.clear());
  }
  await Promise.all(toClear);
  console.log("Empty DB: cleared all KeyV");
}

// For now we use JS data structures instead of a DB
// Removes need for an admin interface during dev
console.log("Loading config data from " + NODE.configDir);
let cepTypes = await utils.load_data_async(NODE.configDir, "ceptypes");
cepTypes = utils.flattenObjects(cepTypes);
//console.log("cepTypes", JSON.stringify(cepTypes, null, 2))
let serviceTypes = await utils.load_data_async(NODE.configDir, "servicetypes");
serviceTypes = utils.flattenObjects(serviceTypes);
//console.log("serviceTypes", JSON.stringify(serviceTypes, null, 2))
let operatorTypes = await utils.load_data_async(NODE.configDir, "operatortypes");
operatorTypes = utils.flattenObjects(operatorTypes);
//console.log("operatorTypes from dir", NODE.configDir, JSON.stringify(operatorTypes, null, 2))

// This can be done in parallel

for (const [key, value] of Object.entries(cepTypes)) {
  await cepTypes_async.set(key, value);
}

for (const [key, value] of Object.entries(serviceTypes)) {
  await serviceTypes_async.set(key, value);
}

for (const [key, value] of Object.entries(operatorTypes)) {
  await operatorTypes_async.set(key, value);
}

export {
  cacheStore_async,
  taskDataStore_async,
  connections,
  activeTaskFsm,
  db,
  tasksStore_async,
  usersStore_async,
  groupsStore_async,
  tasktypesStore_async,
  sharedStore_async,
  setActiveTask_async,
  getActiveTask_async,
  CEPsMap, 
  ServicesMap, 
  OperatorsMap,
  cepTypes_async,
  serviceTypes_async,
  operatorTypes_async,
  CEPMatchMap,
};
