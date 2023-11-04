/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import * as dotenv from "dotenv";
import { NODE } from "../config.mjs";
import { newKeyV, redisClient } from "./shared/storage/redisKeyV.mjs";
dotenv.config();
import { utils } from "./utils.mjs";
import { EventEmitter } from 'events';
import sqlite3 from 'sqlite3';
const { verbose } = sqlite3;
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { exec as execCallback } from 'child_process';
import { readFile } from 'fs/promises';
import fs from 'fs';
import { promisify } from 'util';

// Setting max listeners globally for all new EventEmitter instances
// Was getting warning MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
// This is because keyv adds this.redis.on('error', (error) => this.emit('error', error));
EventEmitter.defaultMaxListeners = 100;

var WSConnections = new Map(); // Stores WebSocket instances with unique session IDs
var activeNodes = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exec = promisify(execCallback);
let loadedAutoStartTasksStore = false;

const dbPath = `${__dirname}/../db/access.sqlite3`;
console.log("accessDB path", dbPath);
const accessDB = new (verbose().Database)(dbPath);

accessDB.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
)`);

// Can't substitute KeyvRedis with Redis drectly because Redis does not store JS objects i.e. the following will not work
//const activeTasksStore_async = new Redis('redis://redis-stack-svc:6379', { keyPrefix: "activeTasks:" });

// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = newKeyV(redisClient, NODE.appAbbrev + "instances");
// Schema:
//   Key: familyId || taskId + userId || taskId + groupId
//   Value: array of instanceId
const familyStore_async = newKeyV(redisClient, NODE.appAbbrev + "family");
// Schema:
//   Key: instanceId
//   Value: boolean indicating the task is active
const activeTasksStore_async = newKeyV(redisClient, NODE.appAbbrev + "activeTasks");
// Schema:
//   Key: instanceId
//   Value: array of nodeIds
const activeTaskNodesStore_async = newKeyV(redisClient, NODE.appAbbrev + "activeTaskNodes");
// Schema:
//   Key: nodeId
//   Value: array of instanceIds
const activeNodeTasksStore_async = newKeyV(redisClient, NODE.appAbbrev + "activeNodeTasks");
// Schema:
//   Key: familyId
//   Value: {taskId : output}
const outputStore_async = newKeyV(redisClient, NODE.appAbbrev + "outputs");
// Schema:
//   Key: familyId (there is also a "system" entry)
//   Value: {shared: task.shared, instanceIds: array of instanceIds}
const sharedStore_async = newKeyV(redisClient, NODE.appAbbrev + "shared");
const connectionsStore_async = newKeyV(redisClient, NODE.appAbbrev + "connections"); // Shared with Hub

async function getActiveTask_async(instanceId) {
  //const start = Date.now();
  if (await activeTasksStore_async.has(instanceId)) {
    let task = await instancesStore_async.get(instanceId);
    //console.log(`getActiveTask_async ${instanceId} took ${Date.now() - start}ms`);
    return task;
  } else {
    console.log("Returned undefined from getActiveTask_async for instanceId:", instanceId);
    return undefined;
  }
}

async function setActiveTask_async(task) {
  utils.assert(task.instanceId !== undefined);
  return Promise.all([
    instancesStore_async.set(task.instanceId, task),
    activeTasksStore_async.set(task.instanceId, true)
  ]);
}

async function deleteActiveTask_async(instanceId) {
  return Promise.all([
    activeTasksStore_async.delete(instanceId),
    activeTaskNodesStore_async.delete(instanceId)
  ]);
}

const usersStore_async = newKeyV(redisClient, NODE.appAbbrev + "users");

const groupsStore_async = newKeyV(redisClient, NODE.appAbbrev + "groups");

const tasktypesStore_async = newKeyV(redisClient, NODE.appAbbrev + "tasktypes");

const tasksStore_async = newKeyV(redisClient, NODE.appAbbrev + "tasks");

const autoStartTasksStore_async = newKeyV(redisClient, NODE.appAbbrev + "autoStartTasks");

if (NODE.storage.emptyAllDB) {
  await Promise.all([
    instancesStore_async.clear(),
    familyStore_async.clear(),
    activeTasksStore_async.clear(),
    activeTaskNodesStore_async.clear(),
    activeNodeTasksStore_async.clear(),
    outputStore_async.clear(),
    sharedStore_async.clear(),
    usersStore_async.clear(),
    groupsStore_async.clear(),
    tasktypesStore_async.clear(),
    tasksStore_async.clear(),
    autoStartTasksStore_async.clear(),
    connectionsStore_async.clear(),
  ]);
  console.log("Empty DB: cleared all KeyV");
}

async function loadOneConfig_async(type) {
  const configDir = '../db/config';
  let initialData = {};
  let runtimeData = {};
  let mergedData = {};
  try {
    let path = join(__dirname, configDir + '/initial/' + type + '.json');
    initialData = JSON.parse(await readFile(path, 'utf8'));
    path = join(__dirname, configDir + '/runtime/' + type + '.json');
    if (fs.existsSync(path)) {
      runtimeData = JSON.parse(await readFile(path, 'utf8'));
      mergedData = utils.deepMerge(initialData, runtimeData);
    } else {
      mergedData = initialData;
    }
    return mergedData;
  } catch (error) {
    console.error('An error occurred while reading configuration files:', error);
  }
}

async function runDumpOneConfigScript(type, verbose = false) {
  try {
    const { stdout, stderr } = await exec('node ' + join(__dirname, '../scripts/dumpOneConfig.js') + ' ' + type);
    if (verbose) {
      const scriptOutput = stdout.trim();
      console.log(scriptOutput);
    }
    const scriptError = stderr.trim();
    if (scriptError) {
      console.error(scriptError);
    }
    // Handle script output as needed
  } catch (error) {
    console.error(`Execution error: ${error}`);
  }
}

async function reloadOneConfig_async(type) { 
  console.log("reloadOneConfig_async", type);
  await runDumpOneConfigScript(type);
  //console.log(`Dumped the config`, type);
  let data = await loadOneConfig_async(type);
  //console.log(`Loaded the config`, type);
  switch (type) {
    case "users":
      await usersStore_async.clear();
      for (const [key, value] of Object.entries(data)) {
        usersStore_async.set(key, value).catch(err => console.log('usersStore_async set error:', err));
      }
      await runDumpOneConfigScript("groups");
      //console.log(`Dumped the config`, type);
      data = await loadOneConfig_async("groups");
      await groupsStore_async.clear();
      for (const [key, value] of Object.entries(data)) {
        groupsStore_async.set(key, value).catch(err => console.log('groupsStore_async set error:', err));
      }
      break;
    case "groups":
      await groupsStore_async.clear();
      for (const [key, value] of Object.entries(data)) {
        groupsStore_async.set(key, value).catch(err => console.log('groupsStore_async set error:', err));
      }
      await runDumpOneConfigScript("users");
      data = await loadOneConfig_async("users");
      await usersStore_async.clear();
      for (const [key, value] of Object.entries(data)) {
        usersStore_async.set(key, value).catch(err => console.log('usersStore_async set error:', err));
      }
      break;
    case "tasks":
      await tasksStore_async.clear();
      for (const [key, value] of Object.entries(data)) {
        tasksStore_async.set(key, value).catch(err => console.log('tasksStore_async set error:', err));
      }
      if (!loadedAutoStartTasksStore) {
        const data = await loadOneConfig_async("autoStartTasks");
        loadedAutoStartTasksStore = true;
        // We do not reload the autoStartTasks - this should require a restart of the app
        for (const [key, value] of Object.entries(data)) {
          autoStartTasksStore_async.set(key, value).catch(err => console.log('autoStartTasksStore_async set error:', err));
        }
      }
      break;
    case "tasktypes":
      await tasktypesStore_async.clear();
      for (const [key, value] of Object.entries(data)) {
        tasktypesStore_async.set(key, value).catch(err => console.log('tasktypesStore_async set error:', err));
      }
      break;
    default:
      throw new Error("Unknown type", type);
  }
  console.log("reloadOneConfig_async", type, "finished");
}

async function initHubConfig_async() { 
  // We need tasktypes before tasks and users before groups
  await reloadOneConfig_async("tasktypes");
  await reloadOneConfig_async("tasks"); // side effect of initializing autoStartTasksStore_async
  await reloadOneConfig_async("users"); // side effect of initializing groupsStore_async
  //await reloadOneConfig_async("groups");
}

await initHubConfig_async();

export {
  instancesStore_async,
  familyStore_async,
  activeTasksStore_async,
  activeTaskNodesStore_async,
  activeNodeTasksStore_async,
  activeNodes,
  outputStore_async,
  sharedStore_async,
  WSConnections,
  getActiveTask_async,
  deleteActiveTask_async,
  setActiveTask_async,
  usersStore_async,
  groupsStore_async,
  tasktypesStore_async,
  tasksStore_async,
  autoStartTasksStore_async,
  connectionsStore_async,
  accessDB,
  reloadOneConfig_async,
};
