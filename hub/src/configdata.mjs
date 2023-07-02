/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "./utils.mjs";
import { CONFIG_DIR } from "../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import assert from "assert";
import { validateTaskflows } from "./validateTaskflows.mjs";
import { fromTask } from "./taskConverterWrapper.mjs";
import fs from 'fs/promises'; // Use promises variant of fs for async/await style
import jsonDiff from 'json-diff'; // You need to install this package: npm install json-diff

// For now we use JS data structures instead of a DB
// Removes need for an admin interface during dev
console.log("Loading config data from " + CONFIG_DIR);
var users = await utils.load_data_async(CONFIG_DIR, "users");
var groups = await utils.load_data_async(CONFIG_DIR, "groups");
var taskflows = await utils.load_data_async(CONFIG_DIR, "taskflows");
var tasktypes = await utils.load_data_async(CONFIG_DIR, "tasktypes");
var tasks = {}; // We will build this from taskflows

// We adopt a DRY strategy in the code and config files
// But not in the data structures that are generated from the config for the code
// Transform hierarchical taskflows structure into a hash
// Build tasks hash from the taskflows hash

tasktypes = utils.flattenObjects(tasktypes);
//console.log(JSON.stringify(tasktypes, null, 2))

try {
  await validateTaskflows(taskflows);
} catch (e) {
  console.error("Error validating taskflows", e);
  throw new Error("Error validating taskflows");
}

function mergeTasks(childTask, tasksObj, id, addStackTaskId = false) {
  if (addStackTaskId) {
    if (childTask.name === "start") {
      childTask["APPEND_stackTaskId"] = [id + "." + childTask.name];
    }
    if (childTask["APPEND_stack"]) {
      const componentCount = childTask["APPEND_stack"].length;
      childTask["APPEND_stackTaskId"] = new Array(componentCount).fill(id + "." + childTask.name);
    }
  }
  for (const key in tasksObj) {
    if (tasksObj.hasOwnProperty(key)) {
      if (key === "tasks" || key === "label" || key === "type" || key === "meta") {continue;}

      if (childTask.hasOwnProperty(key) &&
        !key.startsWith("APPEND_") &&
        !key.startsWith("PREPEND_")
      ) {
        childTask[key] = utils.deepMerge(tasksObj[key], childTask[key]);
      } else if (
        !childTask.hasOwnProperty(key) &&
        !key.startsWith("APPEND_") &&
        !key.startsWith("PREPEND_")
      ){
        childTask[key] = tasksObj[key];
      }

      if (childTask.hasOwnProperty("PREPEND_" + key)) {
        childTask[key] = prependOperation(childTask, key, tasksObj);
      }

      if (childTask.hasOwnProperty("APPEND_" + key)) {
        childTask[key] = appendOperation(childTask, key, tasksObj);
      }

    }
  }
  if (childTask.type) {
    // Need to deal with a list of components
    const tasktemplatename = childTask.type;
    if (tasktypes[tasktemplatename]) {
      for (const key2 in tasktypes[tasktemplatename]) {
        if (key2 !== "id" && key2 !== "name" && key2 !== "parentId" && key2 !== "parentType") {
          //console.log("Adding " + key2, tasktypes[tasktemplatename][key2])
          if (key2 === "config") {
            // ChildTask has priority so it can override default config
            childTask[key2] =  utils.deepMerge(tasktypes[tasktemplatename][key2], childTask[key2])
          } else {
            childTask[key2] =  utils.deepMerge(childTask[key2], tasktypes[tasktemplatename][key2])
          }
        }
      }
    } else {
      console.log("Count not find task template", tasktemplatename)
    }
  }
  
}

function prependOperation(taskflow, key, tasksObj) {
  if (Array.isArray(taskflow["PREPEND_" + key])) {
    return taskflow["PREPEND_" + key].concat(tasksObj[key]);
  } else {
    return taskflow["PREPEND_" + key] + tasksObj[key];
  }
}

function appendOperation(taskflow, key, tasksObj) {
  if (Array.isArray(taskflow["APPEND_" + key])) {
    return tasksObj[key].concat(taskflow["APPEND_" + key]);
  } else {
    return tasksObj[key] + taskflow["APPEND_" + key];
  }
}

// Not that this has huge side-effects
// Transform taskflows array into flattened taskflows hash
// Should flatten taskflows then add parent to tasks then flatten tasks (separate generic functions)
function flattenTaskflows(taskflows) {
  // The default level is named 'root'
  var parent2id = { root: "" };
  var children = {};
  var taskflowLookup = {};
  taskflows.forEach(function (taskflow) {
    // Debug option 
    let debug = false;
    //if (taskflow.name.includes("chatgptzeroshot")) {debug = true;}
    if (debug) {console.log("Taskflow: " + taskflow?.name)}

    // Defensive programming
    if (taskflow.name !== "root" && !parent2id[taskflow.parentType]) {
      throw new Error(
        "Error: Taskflow parentType " +
          taskflow.parentType +
          " does not exist in parent2id");
    }
    
    // Add id
    var id;
    if (taskflow.name === "root") {
      id = "root";
    } else {
      id = parent2id[taskflow.parentType] + "." + taskflow.name;
    }
    if (taskflowLookup[id]) {
      throw new Error("Error: Duplicate taskflow " + id);
    }
    taskflow["id"] = id;

    if (!taskflow.config) {
      taskflow['config'] = {}
    }
    if (!taskflow.config?.label) {
      taskflow.config["label"] = utils.capitalizeFirstLetter(taskflow.name);
    }
    taskflow["meta"] = {};
    if (taskflow.name !== "root") {
      taskflow.meta["parentId"] = parent2id[taskflow.parentType];
    }
    if (id !== "root") {
      let parent = taskflowLookup[taskflow.meta["parentId"]]
      if (parent.meta.childrenId) {
        parent.meta.childrenId.push(taskflow.id);
      } else {
        parent.meta["childrenId"] = [taskflow.id];
      }
    }

    // It might poossible to specify a stack with a list but we do not use this
    if (taskflow["APPEND_stack"]) {
      const componentCount = taskflow["APPEND_stack"].length;
      taskflow["APPEND_stackTaskId"] = new Array(componentCount).fill(id);
    }
    
    // Copy keys from the parentType
    const parentTaskflow = taskflowLookup[taskflow.meta["parentId"]];
    mergeTasks(taskflow, parentTaskflow, id);

    // This should be separated so we deal only with flattening taskflows here
    // The best approach may be to stop distinguishing between taskflow and task
    // Then can either specify hierarchically or using the array format
    // Copy keys from the taskflow that are not in the current tasks
    if (taskflow?.tasks) {
      for (const taskkey in taskflow.tasks) {
        if (taskflow.tasks.hasOwnProperty(taskkey)) {
          taskflow.tasks[taskkey]["name"] = taskkey;
          taskflow.tasks[taskkey]["id"] = id + "." + taskkey;
          if (!taskflow.tasks[taskkey]?.meta) {
            taskflow.tasks[taskkey]["meta"] = {};
          }
          taskflow.tasks[taskkey]["meta"]["parentId"] = taskflow.id;
          taskflow.tasks[taskkey]["meta"]["parentType"] = taskflow.type;
          if (taskflow.meta.childrenId) {
            taskflow.meta.childrenId.push(taskflow.tasks[taskkey]["id"]);
          } else {
            taskflow.meta.childrenId = [taskflow.tasks[taskkey]["id"]];
          }
          // Convert relative task references to absolute
          const nextTask = taskflow.tasks[taskkey]?.config?.nextTask;
          if (nextTask && !nextTask.includes(".")) {
            taskflow.tasks[taskkey].config.nextTask = id + "." + nextTask;
          }
          const nextTaskTemplate = taskflow.tasks[taskkey]?.config?.nextTaskTemplate;
          if (nextTaskTemplate) {
            for (const key in nextTaskTemplate) {
              if (nextTaskTemplate.hasOwnProperty(key)) {
                if (!nextTaskTemplate[key].includes(".")) {
                  nextTaskTemplate[key] = id + "." + nextTaskTemplate[key];
                }
              }
            }
          }
          mergeTasks(taskflow.tasks[taskkey], taskflow, id, true);
        }
      }
    }

    taskflowLookup[id] = taskflow;
    parent2id[taskflow.name] = id;
    // Build children data
    if (children[taskflow.meta["parentId"]]) {
      children[taskflow.meta["parentId"]].push(taskflow.id);
    } else {
      children[taskflow.meta["parentId"]] = [taskflow.id];
    }
  });

  // Replace array of taskflows with hash
  // Array just made it easier for the user to specify parents in the config file
  return taskflowLookup;
}

// This has side-effects, modifying taskflows in-place
// Could check that each taskflow has a 'start' task
taskflows = flattenTaskflows(taskflows);
//console.log(JSON.stringify(taskflows, null, 2))

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
    group.users.forEach(function (userId) {
      // Groups may have users that do not exist
      if (!users[userId]) {
        console.log(
          "Could not find user " + userId + " expected in group " + groupKey
        );
      } else {
        if (users[userId]["groups"]) {
          // Should check that not already in groups
          users[userId]["groups"].push(groupKey);
        } else {
          users[userId]["groups"] = [groupKey];
        }
      }
    });
  }
}

//console.log(JSON.stringify(users, null, 2))

// Flatten the hash of tasks from taskflows
// Add the parentId to task objects
function flattenTasks(taskflows) {
  const tasks = {};
  for (const taskflowKey in taskflows) {
    if (Object.prototype.hasOwnProperty.call(taskflows, taskflowKey)) {
      const taskflow = taskflows[taskflowKey];
      const taskflowId = taskflow.id;
      tasks[taskflowId] = {};
      for (const key in taskflow) {
        if (key !== "tasks") {
          tasks[taskflowId][key] = taskflows[taskflowKey][key];
        }
      }
      const taskflowTasks = taskflows[taskflowKey].tasks;
      if (taskflowTasks) {
        for (const taskKey in taskflowTasks) {
          if (Object.prototype.hasOwnProperty.call(taskflowTasks, taskKey)) {
            const task = taskflows[taskflowKey].tasks[taskKey];
            const taskId = task.id;
            if (!taskId) {
              console.log("taskID not set " + taskKey + " " + taskflowKey);
            }
            tasks[taskId] = task;
            //tasks[taskId]["meta"]["parentId"] = taskflowKey;
            //tasks[taskId]['filter_for_react'] = taskflows[taskflowKey].filter_for_react;
          }
        }
      }
    }
  }
  return tasks;
}

tasks = flattenTasks(taskflows);
//console.log(JSON.stringify(tasks, null, 2))

/**
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

  try {
    const data = await fs.readFile('/tmp/tasks.json', 'utf8');
    existingTasks = JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') { // file does not exist
      await fs.writeFile('/tmp/tasks.json', tasksJson);
      console.log('Successfully wrote tasks to file');
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
//await saveTasks(tasks);

//console.log(JSON.stringify(tasks["root.conversation.chatgptzeroshot.start"], null, 2));
//console.log(JSON.stringify(tasks["root.exercices.production.ecrit.resume.start"], null, 2));

// For each task in tasks run fromTask to validate the task
Object.keys(tasks).forEach(key => {
  const task = tasks[key];
  fromTask(task);
});

export { users, groups, taskflows, tasktypes, tasks };
