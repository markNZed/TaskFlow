/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import Keyv from "keyv";
import KeyvRedis from "@keyv/redis";
import Redis from "ioredis";
import * as dotenv from "dotenv";
dotenv.config();

var connections = new Map(); // Stores WebSocket instances with unique session IDs
var activeProcessors = new Map();
var activeCoProcessors = new Map();

// I had issue swith the redis library still trying localhost, it works with ioredis
const redisClient = new Redis('redis://redis-stack-svc:6379');

redisClient.on('error', function(err) {
  console.log('Could not establish a connection with redis. ' + err);
});

redisClient.on('connect', function() {
  console.log('Connected to redis successfully');
});

function newKeyV(redisClient, namespace) {
  const store = new KeyvRedis(redisClient);
  //console.log(`Using Redis Client for ${namespace} with config:`, redisClient.options);
  const keyv = new Keyv({ store, namespace });
  return keyv;
}

// We could have one keyv store and use prefix for different tables

// Can't substitute KeyvRedis with Redis drectly because Redis does not store JS objects i.e. the following will not work
//const activeTasksStore_async = new Redis('redis://redis-stack-svc:6379', { keyPrefix: "activeTasks:" });

// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = newKeyV(redisClient, "instances");
// Schema:
//   Key: familyId || taskId + userId || taskId + groupId
//   Value: array of instanceId
const familyStore_async = newKeyV(redisClient, "threads");
// Schema:
//   Key: instanceId
//   Value: boolean indicating the task is active
const activeTasksStore_async = newKeyV(redisClient, "activeTasks");
// Schema:
//   Key: instanceId
//   Value: array of processorIds
const activeTaskProcessorsStore_async = newKeyV(redisClient, "activeTaskProcessors");
// Schema:
//   Key: processorId
//   Value: array of instanceIds
const activeProcessorTasksStore_async = newKeyV(redisClient, "activeProcessorTasks");
// Schema:
//   Key: familyId
//   Value: {taskId : output}
const outputStore_async = newKeyV(redisClient, "outputsStore_async");

async function getActiveTask_async(instanceId) {
  if (await activeTasksStore_async.has(instanceId)) {
    return await instancesStore_async.get(instanceId);
  } else {
    return undefined;
  }
}

async function setActiveTask_async(task) {
  await Promise.all([
    instancesStore_async.set(task.instanceId, task),
    activeTasksStore_async.set(task.instanceId, true)
  ]);
}

async function deleteActiveTask_async(instanceId) {
  await Promise.all([
    activeTasksStore_async.delete(instanceId),
    activeTaskProcessorsStore_async.delete(instanceId)
  ]);
}

export {
  instancesStore_async,
  familyStore_async,
  activeTasksStore_async,
  activeTaskProcessorsStore_async,
  activeProcessorTasksStore_async,
  activeProcessors,
  activeCoProcessors,
  outputStore_async,
  connections,
  getActiveTask_async,
  deleteActiveTask_async,
  setActiveTask_async,
};
