/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "./utils.mjs";
import { CONFIG_DIR } from "../config.mjs";
import assert from "assert";
import { validateTasks } from "./validateTasks.mjs";
import { fromTask } from "./taskConverterWrapper.mjs";
import fs from 'fs/promises'; // Use promises variant of fs for async/await style
import jsonDiff from 'json-diff'; // You need to install this package: npm install json-diff

// For now we use JS data structures instead of a DB
// Removes need for an admin interface during dev
console.log("Loading config data from " + CONFIG_DIR);
var users = await utils.load_data_async(CONFIG_DIR, "users");
var groups = await utils.load_data_async(CONFIG_DIR, "groups");
var tasks = await utils.load_data_async(CONFIG_DIR, "tasks");
var tasktypes = await utils.load_data_async("../config", "tasktypes");
var autoStartTasks = {};

// We adopt a DRY strategy in the code and config files
// But not in the data structures that are generated from the config for the code
// Transform hierarchical tasks structure into a hash
// Build tasks hash from the tasks array

tasktypes = utils.flattenObjects(tasktypes);
//console.log(JSON.stringify(tasktypes, null, 2))

try {
  await validateTasks(tasks);
} catch (e) {
  console.error("Error validating tasks", e);
  throw new Error("Error validating tasks");
}

function mergeTasks(task, parentTask) {
  // Merge the taskType first so we can take APPEND_ PREPREND_ into account from tasktype
  if (task.type) {
    // Need to deal with a list of components
    const tasktemplatename = task.type;
    if (tasktypes[tasktemplatename]) {
      for (const key2 in tasktypes[tasktemplatename]) {
        if (key2 !== "id" && key2 !== "name" && key2 !== "parentName") {
          //console.log("Adding " + key2, tasktypes[tasktemplatename][key2])
          if (key2 === "config") {
            // ChildTask has priority so it can override default config
            task[key2] =  utils.deepMerge(tasktypes[tasktemplatename][key2], task[key2])
          } else {
            task[key2] =  utils.deepMerge(task[key2], tasktypes[tasktemplatename][key2])
          }
        }
      }
    } else {
      console.log("Count not find task template", tasktemplatename)
    }
  }
  for (const key in parentTask) {
    if (parentTask.hasOwnProperty(key)) {
      if (key === "label" || key === "type" || key === "meta" || key === "initiator") {
        continue;
      }
      if (key === "config" && task.config) {
        for (const configKey in parentTask.config) {
          // We don't want to copy task.config.local
          if (configKey !== "local" && configKey !== "ceps" && configKey !== "subtasks") {
            mergeObj(task.config, configKey, parentTask.config);
          }
        }
      } else {
        mergeObj(task, key, parentTask);
      }
    }
  }  
}

// Could replace PREPEND_ with ...+ and APPEND with +...
function mergeObj(task, key, parentTask) {
  if (task.hasOwnProperty("PREPEND_" + key)) {
    task[key] = prependOperation(task, key, parentTask);
  } else if (task.hasOwnProperty("APPEND_" + key)) {
    task[key] = appendOperation(task, key, parentTask);
  // Don't copy LOCAL info (specific to the task)
  } else if (!key.startsWith("LOCAL_") && !parentTask.hasOwnProperty("LOCAL_" + key)) {
    if (task.hasOwnProperty(key)) {
      task[key] = utils.deepMerge(parentTask[key], task[key]);
     } else {
      task[key] = parentTask[key];
    }
  }
}

function prependOperation(task, key, parentTask) {
  if (Array.isArray(task["PREPEND_" + key])) {
    return task["PREPEND_" + key].concat(parentTask[key]);
  } else {
    return task["PREPEND_" + key] + parentTask[key];
  }
}

function appendOperation(task, key, parentTask) {
  if (Array.isArray(task["APPEND_" + key])) {
    return parentTask[key].concat(task["APPEND_" + key]);
  } else {
    return parentTask[key] + task["APPEND_" + key];
  }
}

function copyLocalKeys(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {

      // Recurse if it's an object and not null.
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        copyLocalKeys(obj[key]);
      }

      // Check for "LOCAL_" prefix.
      if (key.startsWith("LOCAL_")) {
        const newKey = key.slice(6);
        if (!obj.hasOwnProperty(newKey)) {
          obj[newKey] = obj[key];
        }
      }

    }
  }
  return obj;
}

function stripChildrenPrefix(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        stripChildrenPrefix(obj[key]);
      }
      if (key.startsWith("CHILDREN_")) {
        obj[key.slice(9)] = obj[key];
        delete obj[key];
      }
    }
  }
  return obj;
}

function stripAppendKeys(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        stripChildrenPrefix(obj[key]);
      }
      if (key.startsWith("APPEND_")) {
        const keyToAppend = key.slice(9);
        delete obj[keyToAppend];
      }
    }
  }
  return obj;
}

// Not that this has huge side-effects
// Transform tasks array into flattened tasks hash
function flattenTasks(tasks) {
  // The default level is named 'root'
  var parent2id = { root: "" };
  var children = {};
  var taskLookup = {};
  tasks.forEach(function (task) {
    // Debug option 
    let debug = false;
    //if (task.name.includes("chatgptzeroshot")) {debug = true;}
    if (debug) {console.log("Taskflow: " + task?.name)}

    const parentId = parent2id[task.parentName]
    
    // Defensive programming
    if (task.name !== "root" && !parentId) {
      throw new Error(
        "Error: Taskflow parentName " +
          task.parentName +
          " does not exist in parent2id");
    }
    
    // Add id
    var id;
    if (task.name === "root") {
      id = "root";
    } else {
      id = parentId + "." + task.name;
    }
    if (taskLookup[id]) {
      throw new Error("Error: Duplicate task " + id);
    }
    task["id"] = id;

    if (!task.config) {
      task['config'] = {}
    }
    if (task.config?.label === undefined) {
      task.config["label"] = utils.capitalizeFirstLetter(task.name);
    }
    task["meta"] = {};
    if (task.name !== "root") {
      task.meta["parentId"] = parentId;
    }
    if (id !== "root") {
      let parent = taskLookup[parentId]
      if (parent.meta.childrenId) {
        parent.meta.childrenId.push(task.id);
      } else {
        parent.meta["childrenId"] = [task.id];
      }
    }

    // Copy LOCAL_ keys
    task = copyLocalKeys(task);
    
    // Copy keys from the parent
    if (taskLookup[parentId]) {
      const parentTaskflow = JSON.parse(JSON.stringify(taskLookup[parentId]));
      stripChildrenPrefix(parentTaskflow);
      stripAppendKeys(parentTaskflow);
      mergeTasks(task, parentTaskflow);
    }

    // Convert relative task references to absolute
    const nextTask = task?.config?.nextTask;
    if (nextTask && !nextTask.includes(".")) {
      task.config.nextTask = parentId + "." + nextTask;
    }
    const nextTaskTemplate = task?.config?.nextTaskTemplate;
    if (nextTaskTemplate) {
      for (const key in nextTaskTemplate) {
        if (nextTaskTemplate.hasOwnProperty(key)) {
          if (!nextTaskTemplate[key].includes(".")) {
            nextTaskTemplate[key] = parentId + "." + nextTaskTemplate[key];
          }
        }
      }
    }

    if (task?.config?.autoStartEnvironment) {
      autoStartTasks[task.id] = {
        startEnvironment: task.config.autoStartEnvironment,
        startEnvironments: task.environments,
        once: task.config.autoStartOnce,
      }
    }
    
    taskLookup[id] = task;
    parent2id[task.name] = id;
    // Build children data
    if (children[parentId]) {
      children[parentId].push(task.id);
    } else {
      children[parentId] = [task.id];
    }
  });

  // Replace array of tasks with hash
  // Array just made it easier for the user to specify parents in the config file
  return taskLookup;
}

// This has side-effects, modifying tasks in-place
// Could check that each task has a 'start' task
tasks = flattenTasks(tasks);
//console.log(JSON.stringify(tasks, null, 2))

users = utils.flattenObjects(users);
//console.log(JSON.stringify(users, null, 2))

//Create a group for each user
for (const userKey in users) {
  if (users.hasOwnProperty(userKey)) {
    //console.log("Creating group for user " + userKey)
    if (!groups[userKey]) {
      const group = {
        name: users[userKey].name,
        users: [userKey],
      }
      groups.push(group)
    }
  }
}

groups = utils.flattenObjects(groups);
//console.log(JSON.stringify(groups, null, 2))

//Add list of groups to each user (a view in a DB)
for (const groupKey in groups) {
  if (groups.hasOwnProperty(groupKey)) {
    const group = groups[groupKey];
    assert(group.hasOwnProperty("users"), "Group " + groupKey + " has no users");
    group.users.forEach(function (id) {
      // Groups may have users that do not exist
      if (!users[id]) {
        console.log(
          "Could not find user " + id + " expected in group " + groupKey
        );
      } else {
        if (users[id]["groups"]) {
          // Should check that not already in groups
          users[id]["groups"].push(groupKey);
        } else {
          users[id]["groups"] = [groupKey];
        }
      }
    });
  }
}
//console.log(JSON.stringify(users, null, 2))

/*
 * Save tasks to a file if the file does not exist.
 * If the file exists then perform a diff.
 * This is useful during refactoring to make sure intentional changes are made.
 *
 * @param {Array} tasks - An array of tasks to be saved.
 * @return {Promise<void>} A promise that resolves when the tasks are saved successfully.
 */
async function saveTasks(tasks) {
  const tasksJson = JSON.stringify(tasks, null, 2);
  let existingTasks;
  const filePath = '/tmp/tasks.json';

  try {
    const data = await fs.readFile('/tmp/tasks.json', 'utf8');
    existingTasks = JSON.parse(data);
    console.log('Successfully read tasks from file ' + filePath);
  } catch (error) {
    if (error.code === 'ENOENT') { // file does not exist
      await fs.writeFile(filePath, tasksJson);
      console.log('Successfully wrote tasks to file ' + filePath);
      return;
    } else {
      console.error('Error reading file', error);
      return;
    }
  }

  const diff = jsonDiff.diffString(existingTasks, tasks);
  if (diff) {
    console.log('Differences between the existing tasks and the new tasks:', diff);
  } else {
    console.log('No differences found');
  }
}
await saveTasks(tasks);

//console.log(JSON.stringify(tasks["root.conversation.chatgptzeroshot.start"], null, 2));
//console.log(JSON.stringify(tasks["root.exercices.production.ecrit.resume.start"], null, 2)); 

// For each task in tasks run fromTask to validate the task
Object.keys(tasks).forEach(key => {
  const task = tasks[key];
  fromTask(task);
});

function getConfigHash() {
  return utils.djb2Hash(JSON.stringify([users, groups, tasktypes, tasks]));
}

export { users, groups, tasktypes, tasks, getConfigHash, autoStartTasks };
