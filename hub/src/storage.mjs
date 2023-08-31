/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import Keyv from "keyv";
import KeyvRedis from "@keyv/redis";
import Redis from "ioredis";
import * as dotenv from "dotenv";
import { users, groups, tasktypes, tasks, autoStartTasks } from "./configdata.mjs";
dotenv.config();

var connections = new Map(); // Stores WebSocket instances with unique session IDs
var activeProcessors = new Map();
var activeCoProcessors = new Map();

// I had issue swith the redis library still trying localhost, it works with ioredis
const redisClient = new Redis('redis://redis-stack-svc:6379');
/*
  From the Redic CLI
    CONFIG GET appendonly
    "yes"
    CONFIG GET dir
    "/data"
    CONFIG GET appendfilename
    "appendonly.aof"
    CONFIG GET appendfsync
    "everysec"
*/
redisClient.config("SET", "appendonly", "yes");


redisClient.on('error', function(err) {
  console.log('Could not establish a connection with redis. ' + err);
});

redisClient.on('connect', function() {
  console.log('Connected to redis successfully');
});

class ExtendedKeyvRedis extends KeyvRedis {
  constructor(redisClient, options = {}) {
    super(redisClient, options);
    this.redis = redisClient; // You already have a Redis client; no need to create a new one
    this.namespace = options.namespace; // Store the namespace for later
  }
  async *iterate() {
    let cursor = '0';
    const matchPattern = this.namespace ? `${this.namespace}:*` : null;
    do {
      // Use SCAN to get an array where the first element is the new cursor and the second is the list of keys
      const scanOptions = matchPattern ? ['MATCH', matchPattern] : [];
      const [newCursor, keys] = await this.redis.scan(cursor, ...scanOptions);
      for (const key of keys) {
        let realKey = key;
        // Remove the 'sets:' prefix if it exists
        if (realKey.startsWith('sets:')) {
          realKey = realKey.substring(5);
        }
        // Remove the namespace if it exists
        if (this.namespace && realKey.startsWith(`${this.namespace}:`)) {
          realKey = realKey.substring(this.namespace.length + 1);
        }
        let value = await this.get(key); // Use Keyv's get method to deserialize and get the value
        try {
          if (typeof value === 'string') {
            value = JSON.parse(value);
          }
          if (value && value.value) {
            value = value.value;
          }
        } catch (e) {
          value = null;
        }
        yield { key: realKey, value };
      }
      cursor = newCursor;
    } while (cursor !== '0');
  }
}


/*
// Usage
async function iterateThroughStore() {
  // We must use "key" and "valie" here
  for await (const { key, value } of store.iterate()) {
    console.log(key, value);
  }
}
*/

function newKeyV(redisClient, namespace) {
  const store = new ExtendedKeyvRedis(redisClient);
  //console.log(`Using Redis Client for ${namespace} with config:`, redisClient.options);
  // Can pass TTL to keyv e.g. 24 hrs
  // const ttl = 1000 * 60 * 60 * 24;
  const keyv = new Keyv({ store, namespace });

  // Attach the iterate method to the keyv instance
  keyv.iterate = async function*() {
    for await (const item of store.iterate()) {
      yield item;
    }
  };

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
const outputStore_async = newKeyV(redisClient, "outputs");

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

const usersStore_async = newKeyV(redisClient, "users");
for (const [key, value] of Object.entries(users)) {
  usersStore_async.set(key, value).catch(err => console.log('usersStore_async set error:', err));
}

const groupsStore_async = newKeyV(redisClient, "groups");
for (const [key, value] of Object.entries(groups)) {
  groupsStore_async.set(key, value).catch(err => console.log('groupsStore_async set error:', err));
}

const tasktypesStore_async = newKeyV(redisClient, "tasktypes");
for (const [key, value] of Object.entries(tasktypes)) {
  tasktypesStore_async.set(key, value).catch(err => console.log('tasktypesStore_async set error:', err));
}

const tasksStore_async = newKeyV(redisClient, "tasks");
for (const [key, value] of Object.entries(tasks)) {
  tasksStore_async.set(key, value).catch(err => console.log('tasksStore_async set error:', err));
}

const autoStartTasksStore_async = newKeyV(redisClient, "autoStartTasks");
console.log("autoStartTasks", autoStartTasks);
for (const [key, value] of Object.entries(autoStartTasks)) {
  console.log("autoStartTasks", key, value);
  autoStartTasksStore_async.set(key, value).catch(err => console.log('autoStartTasksStore_async set error:', err));
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
  usersStore_async,
  groupsStore_async,
  tasktypesStore_async,
  tasksStore_async,
  autoStartTasksStore_async,
};
