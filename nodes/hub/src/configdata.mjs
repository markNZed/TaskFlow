/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "./utils.mjs";
import { NODE } from "../config.mjs";
import assert from "assert";
import { validateTasks } from "./validateTasks.mjs";
import { fromTask } from "./taskConverterWrapper.mjs";
import fs from 'fs/promises'; // Use promises variant of fs for async/await style
import jsonDiff from 'json-diff'; // You need to install this package: npm install json-diff

async function loadConfigOne_async(type) {
  const config = await utils.load_data_async(NODE.configDir, type);
  return config;
}

// We adopt a DRY strategy in the code and config files
// But not in the data structures that are generated from the config for the code
// Transform hierarchical tasks structure into a hash
// Build tasks hash from the tasks array

function initTasktypes(tasktypes) {
  tasktypes = utils.flattenObjects(tasktypes);
  //console.log(JSON.stringify(tasktypes, null, 2))
  return tasktypes;
}

function mergeTasks(tasktypes, task, parentTask) {
  // Merge the taskType first so we can take APPEND_ PREPREND_ into account from tasktype
  //console.log("mergeTasks ", task.id, parentTask.id);
  if (task.type) {
    // Need to deal with a list of components
    const tasktemplatename = task.type;
    let template = tasktypes[tasktemplatename];
    // Copy LOCAL_ keys
    template = copyLocalKeys(template);
    if (template) {
      for (const key2 in tasktypes[tasktemplatename]) {
        if (key2 !== "id" && key2 !== "name" && key2 !== "parentName") {
          //console.log("Adding " + key2, tasktypes[tasktemplatename][key2])
          if (["config", "connections", "operators", "ceps", "services", "shared"].includes(key2)) {
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
    if (parentTask[key] !== undefined) {
      if (["label", "type", "meta", "initiator", "connections"].includes(key)) {
        continue;
      }
      if (key === "config" && task.config) {
        for (const configKey in parentTask.config) {
          // We don't want to copy task.config.local
          if (configKey !== "local") {
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
  if (task["PREPEND_" + key] !== undefined) {
    task[key] = prependOperation(task, key, parentTask);
  } else if (task["APPEND_" + key] !== undefined) {
    task[key] = appendOperation(task, key, parentTask);
  // Don't copy LOCAL info (specific to the task)
  } else if (!key.startsWith("LOCAL_") && !parentTask["LOCAL_" + key]) {
    if (task[key] !== undefined) {
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
    if (obj[key] !== undefined) {
      // Recurse if it's an object and not null.
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        copyLocalKeys(obj[key]);
      }
      // Check for "LOCAL_" prefix.
      if (key.startsWith("LOCAL_")) {
        const newKey = key.slice(6);
        //console.log("Setting LOCAL_", newKey, obj[key]);
        // Check for references to parent values e.g. name:path
        obj[newKey] = obj[key];
      }

    }
  }
  return obj;
}

function stripChildrenPrefix(obj) {
  for (const key in obj) {
    if (obj[key] !== undefined) {
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
    if (obj[key] !== undefined) {
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
function flattenTasks(tasktypes, tasksConfig) {
  // The default level is named 'root'
  var parent2id = { root: "" };
  var children = {};
  var taskLookup = {};
  let autoStartTasks = {};
  tasksConfig.forEach(function (task) {
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
          " does not exist in parent2id while reading task " + task?.name);
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
    if (!task["meta"]) {
      task["meta"] = {};
    }
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
      mergeTasks(tasktypes, task, parentTaskflow);
    }

    // Process APPEND_, PREPEND_
    mergeTasks(tasktypes, task, task);

    // Convert relative task references to absolute
    const nextTask = task?.config?.nextTask;
    if (nextTask && !nextTask.includes(".")) {
      task.config.nextTask = parentId + "." + nextTask;
    }
    const nextTaskTemplate = task?.config?.nextTaskTemplate;
    if (nextTaskTemplate) {
      for (const key in nextTaskTemplate) {
        if (nextTaskTemplate[key] !== undefined) {
          if (!nextTaskTemplate[key].includes(".")) {
            nextTaskTemplate[key] = parentId + "." + nextTaskTemplate[key];
          }
        }
      }
    }

    if (task?.config?.autoStartEnvironments && !task?.config?.autoStartEnvironment) {
      task.config["autoStartEnvironment"] = task.config.autoStartEnvironments[0];
    }

    if (!task.environments) {
      if (task?.config?.autoStartEnvironments) {
        task.environments = task.config.autoStartEnvironments;
      } else if (task?.config?.autoStartEnvironment) {
        task.environments = [task.config.autoStartEnvironment];
      }
    }

    if (task?.config?.autoStartEnvironment) {
      autoStartTasks[task.id] = {
        startEnvironment: task.config.autoStartEnvironment,
        // So we can start a task on a subset of the task.environments (used this for TaskSystemConfig)
        startEnvironments: task.config.autoStartEnvironments || task.environments,
        once: task.config.autoStartOnce,
      }
      console.log("task.id", task.id, "startEnvironments", autoStartTasks[task.id]["startEnvironments"]);
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
  return [taskLookup, autoStartTasks];
}

function initTasks(tasktypes, tasksConfig) {
  try {
    validateTasks(tasksConfig);
  } catch (e) {
    console.error("Error validating tasksConfig", e);
    throw new Error("Error validating tasksConfig");
  }
  // This has side-effects, modifying tasks in-place
  // Could check that each task has a 'start' task
  const [flattasks, autoStartTasks] = flattenTasks(tasktypes, tasksConfig);
  //console.log(JSON.stringify(tasks, null, 2))
  // For each task in tasks run fromTask to validate the task
  Object.keys(flattasks).forEach(key => {
    const task = flattasks[key];
    fromTask(task);
  });
  return [flattasks, autoStartTasks];
}

function initUsers(users) {
  let groups = {};
  users = utils.flattenObjects(users);
  //console.log(JSON.stringify(users, null, 2))
  //Create a group for each user
  for (const userKey in users) {
    if (users[userKey]) {
      //console.log("Creating group for user " + userKey)
      if (groups[userKey] === undefined) {
        const group = {
          name: userKey,
          users: [userKey],
        }
        groups[userKey] = group;
      }
    }
  }
  return [users, groups];
}

function initTribes(users) {
  users = utils.flattenObjects(users);
  return users;
}

function initGroups(users, groupsConfig, groups) {
  const newGroups = utils.flattenObjects(groupsConfig);
  groups = utils.deepMerge(groups, newGroups);
  //console.log(JSON.stringify(groups, null, 2))
  //Add list of groups to each user (a view in a DB)
  for (const groupKey in groups) {
    if (groups[groupKey]) {
      const group = groups[groupKey];
      assert(group["users"], "Group " + groupKey + " has no users");
      group.users.forEach(function (id) {
        // Groups may have users that do not exist
        if (users[id] === undefined) {
          console.log(
            "Could not find user " + id + " expected in group " + groupKey
          );
        } else {
          if (users[id]["groups"]) {
            if (!users[id]["groups"].includes(groupKey)) {
              users[id]["groups"].push(groupKey);
            }
          } else {
            users[id]["groups"] = [groupKey];
          }
        }
      });
    }
  }
  //console.log(JSON.stringify(users, null, 2))
  return [groups, users];
}

/*
 * Save config to a file if the file does not exist.
 * If the file exists then perform a diff.
 * This is useful during refactoring to make sure intentional changes are made.
 *
 * @param {Array} tasks - An array of tasks to be saved.
 * @return {Promise<void>} A promise that resolves when the tasks are saved successfully.
 */
async function dumpConfig(configData, configName) {
  const configDataJson = JSON.stringify(configData, null, 2);
  let prevConfigData;
  const filePath = `/tmp/taskflow-${configName}.json`;
  try {
    const data = await fs.readFile(filePath, 'utf8');
    prevConfigData = JSON.parse(data);
    console.log(`Successfully read configData from file ${filePath}`);
  } catch (error) {
    if (error.code === 'ENOENT') { // file does not exist
      await fs.writeFile(filePath, configDataJson);
      console.log(`Successfully wrote ${configName} to file ${filePath}`);
      return;
    } else {
      console.error('Error reading file', error);
      return;
    }
  }
  const diff = jsonDiff.diffString(prevConfigData, configData);
  if (diff) {
    console.log('Differences between the previous ${configName} and the new ${configName}:', diff);
  } else {
    console.log('No differences found');
  }
}

async function configInitOne_async(type) {
  console.log("configInitOne_async loadConfigOne_async", type);
  let config = await loadConfigOne_async(type);
  config = utils.deepClone(config);
  switch (type) {
    case "tasktypes":
      tasktypes = initTasktypes(config);
      break;
    case "tasks":
      if (!tasktypes) {
        await configInitOne_async("tasktypes")
      }
      [tasks, autoStartTasks] = initTasks(tasktypes, config);
      if (NODE.dumpConfigs) {
        await dumpConfig(tasks, "tasks");
      }
      break;
    case "users":
      [users, groups] = initUsers(config);
      await configInitOne_async("groups");
      break;
    case "groups":
      if (!users) {
        await configInitOne_async("users");
      }
      [groups, users] = initGroups(users, config, groups);
      break;
    case "tribes":
      tribes = initTribes(config);
      //console.log("tribes:", utils.js(tribes, null,2));
      break;
    default:
      throw new Error("Unknown config", type);
  }
}

// The variables will be initialized when configInit_async is called
var users, groups, tasktypes, tasks, autoStartTasks, tribes;

export { configInitOne_async, users, groups, tasktypes, tasks, autoStartTasks, tribes };
