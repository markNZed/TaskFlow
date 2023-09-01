/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import * as dotenv from "dotenv";
import { users, groups, tasktypes, tasks, autoStartTasks } from "./configdata.mjs";
import { newKeyV, redisClient } from "./shared/storage/redisKeyV.mjs";
dotenv.config();

var connections = new Map(); // Stores WebSocket instances with unique session IDs
var activeProcessors = new Map();
var activeCoProcessors = new Map();

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

const groupsStore_async = newKeyV(redisClient, "groups");

const tasktypesStore_async = newKeyV(redisClient, "tasktypes");

const tasksStore_async = newKeyV(redisClient, "tasks");

const autoStartTasksStore_async = newKeyV(redisClient, "autoStartTasks");

await Promise.all([
  instancesStore_async.clear(),
  familyStore_async.clear(),
  activeTasksStore_async.clear(),
  activeTaskProcessorsStore_async.clear(),
  activeProcessorTasksStore_async.clear(),
  outputStore_async.clear(),
  usersStore_async.clear(),
  groupsStore_async.clear(),
  tasktypesStore_async.clear(),
  tasksStore_async.clear(),
  autoStartTasksStore_async.clear(),
]);
console.log("Cleared all KeyV");

for (const [key, value] of Object.entries(users)) {
  usersStore_async.set(key, value).catch(err => console.log('usersStore_async set error:', err));
}
for (const [key, value] of Object.entries(groups)) {
  groupsStore_async.set(key, value).catch(err => console.log('groupsStore_async set error:', err));
}
for (const [key, value] of Object.entries(tasktypes)) {
  tasktypesStore_async.set(key, value).catch(err => console.log('tasktypesStore_async set error:', err));
}
for (const [key, value] of Object.entries(tasks)) {
  tasksStore_async.set(key, value).catch(err => console.log('tasksStore_async set error:', err));
}
for (const [key, value] of Object.entries(autoStartTasks)) {
  autoStartTasksStore_async.set(key, value).catch(err => console.log('autoStartTasksStore_async set error:', err));
}

console.log("Initialized usersStore_async, groupsStore_async, tasktypesStore_async, tasksStore_async, autoStartTasksStore_async");

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
