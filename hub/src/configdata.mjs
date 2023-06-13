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

// Not that this has huge side-effects
// Transform taskflows array into flattened taskflows hash
// We should introduce a concept of appending and prepending
// e.g. PREPEND_property would prepend the content to content form higher level instead of replacing content
// Functionality added but not tested
// Should flatten taskflows then add parent to tasks then flatten tasks (separate generic functions)
function flattenTaskflows(taskflows) {
  // The default level is named 'root'
  var parent2id = { root: "" };
  var children = {};
  const regex_lowercase = /^[a-z]+$/;
  var taskflowLookup = {};
  taskflows.forEach(function (taskflow) {
    //console.log("Taskflow: " + taskflow?.name)
    if (!taskflow?.name) {
      throw new Error("Error: Taskflow missing name");
    }
    if (!taskflow?.parentType && taskflow.name !== "root") {
      throw new Error("Error: Taskflow missing parentType " + taskflow.name);
    }
    /* Removed so we can have component names
    if (!regex_lowercase.test(taskflow.name)) {
      throw new Error('Error: Taskflow name should only include lowercase characters ' + taskflow.name)
    }
    */
    if (!parent2id[taskflow.parentType] && taskflow.name !== "root") {
      throw new Error(
        "Error: Taskflow parentType " +
          taskflow.parentType +
          " does not exist in " +
          taskflow.name
      );
    }
    var id;
    if (taskflow.name === "root") {
      id = "root";
    } else {
      id = parent2id[taskflow.parentType] + "." + taskflow.name;
    }
    if (taskflowLookup[id]) {
      throw new Error("Error: Duplicate taskflow " + id);
    }
    // Add id to each task
    if (taskflow?.tasks) {
      for (const key in taskflow.tasks) {
        if (taskflow.tasks.hasOwnProperty(key)) {
          taskflow.tasks[key]["name"] = key;
          taskflow.tasks[key]["id"] = id + "." + key;
          // Avoid the task inheriting the label from the Taskflow
          if (!taskflow.tasks[key]["label"]) {
            taskflow.tasks[key]["label"] = "";
          }
          // Convert relative task references to absolute
          if (
            taskflow.tasks[key]["nextTask"] &&
            !taskflow.tasks[key]["nextTask"].includes(".")
          ) {
            taskflow.tasks[key]["nextTask"] =
              id + "." + taskflow.tasks[key]["nextTask"];
          }
          if (
            taskflow.tasks[key]["config"] &&
            taskflow.tasks[key]["config"]["nextStateTemplate"]
          ) {
            let nt = taskflow.tasks[key]["config"]["nextStateTemplate"];
            for (const key in nt) {
              if (nt.hasOwnProperty(key)) {
                if (!nt[key].includes(".")) {
                  nt[key] = id + "." + nt[key];
                }
              }
            }
          }
        }
      }
    }
    if (!taskflow.config) {
      taskflow['config'] = {}
    }
    if (!taskflow.config?.label) {
      taskflow.config["label"] = utils.capitalizeFirstLetter(taskflow.name);
    }
    taskflow["id"] = id;
    taskflow["parentId"] = parent2id[taskflow.parentType];
    // Copy all the keys from the parentType that are not in the current taskflow
    // Could create functions here for PREPEND_ and APPEND_
    const parentTaskflow = taskflowLookup[taskflow["parentId"]];
    for (const key in parentTaskflow) {
      if (parentTaskflow.hasOwnProperty(key)) {
        if (
          !taskflow.hasOwnProperty(key) &&
          !key.startsWith("APPEND_") &&
          !key.startsWith("PREPEND_")
        ) {
          taskflow[key] = parentTaskflow[key];
        }
        if (taskflow.hasOwnProperty("PREPEND_" + key)) {
          if (Array.isArray(taskflow["PREPEND_" + key])) {
            taskflow[key] = taskflow["PREPEND_" + key].concat(
              parentTaskflow[key]
            );
          } else {
            taskflow[key] = taskflow["PREPEND_" + key] + parentTaskflow[key];
          }
          //console.log("Taskflow " + taskflow.id + " PREPEND_ ", taskflow['PREPEND_' + key], " to " + key)
        }
        if (taskflow.hasOwnProperty("APPEND_" + key)) {
          if (Array.isArray(taskflow["APPEND_" + key])) {
            taskflow[key] = parentTaskflow[key].concat(
              taskflow["APPEND_" + key]
            );
          } else {
            taskflow[key] = parentTaskflow[key] + taskflow["APPEND_" + key];
          }
          //console.log("Taskflow " + taskflow.id + " APPEND_ ", taskflow['APPEND_' + key], " to " + key)
        }
      }
    }
    // Copy all the keys from the taskflow that are not in the current tasks
    if (taskflow?.tasks) {
      for (const taskkey in taskflow.tasks) {
        if (taskflow.tasks.hasOwnProperty(taskkey)) {
          for (const taskflowkey in taskflow) {
            if (taskflow.hasOwnProperty(taskflowkey)) {
              // Will not override, need to merge?
              if (
                !taskflow.tasks[taskkey].hasOwnProperty(taskflowkey) &&
                taskflowkey !== "tasks" &&
                !taskflowkey.startsWith("APPEND_") &&
                !taskflowkey.startsWith("PREPEND_")
              ) {
                taskflow.tasks[taskkey][taskflowkey] = taskflow[taskflowkey];
                if (
                  taskflow.tasks[taskkey].hasOwnProperty(
                    "PREPEND_" + taskflowkey
                  )
                ) {
                  if (
                    Array.isArray(
                      taskflow.tasks[taskkey]["PREPEND_" + taskflowkey]
                    )
                  ) {
                    taskflow.tasks[taskkey][taskflowkey] = taskflow.tasks[
                      taskkey
                    ]["PREPEND_" + taskflowkey].concat(taskflow[taskflowkey]);
                  } else {
                    taskflow.tasks[taskkey][taskflowkey] =
                      taskflow.tasks[taskkey]["PREPEND_" + taskflowkey] +
                      taskflow[taskflowkey];
                  }
                } else if (
                  taskflow.tasks[taskkey].hasOwnProperty(
                    "APPEND_" + taskflowkey
                  )
                ) {
                  if (
                    Array.isArray(
                      taskflow.tasks[taskkey]["APPEND_" + taskflowkey]
                    )
                  ) {
                    taskflow.tasks[taskkey][taskflowkey] = taskflow[
                      taskflowkey
                    ].concat(taskflow.tasks[taskkey]["APPEND_" + taskflowkey]);
                  } else {
                    taskflow.tasks[taskkey][taskflowkey] =
                      taskflow[taskflowkey] +
                      taskflow.tasks[taskkey]["APPEND_" + taskflowkey];
                  }
                }
              }
            }
          }

          // APPEND_stack should be the tasktemplate name
          // We will copy the tasktemplate into the task
          if (taskflow.tasks[taskkey]["APPEND_stack"]) {
            if (taskflow.tasks[taskkey]["APPEND_stack"].length !== 1) {
              console.log("APPEND_stack should be an array of length 1");
            }
            const tasktemplate = "root." + taskflow.tasks[taskkey]["APPEND_stack"][0];
            if (tasktypes[tasktemplate]) {
              taskflow.tasks[taskkey]
              // for each taskkey in the tasktemplate copy it into this task
              // Should detect conflices if there is a conflict
              // Should be merging not looping
              for (const key2 in tasktypes[tasktemplate]) {
                if (key2 !== "id" && key2 !== "name" && key2 !== "parentId" && key2 !== "parentType") {
                  //console.log("Adding " + key2, tasktypes[tasktemplate][key2])
                  taskflow.tasks[taskkey][key2] =  utils.deepMerge(tasktypes[tasktemplate][key2], taskflow.tasks[taskkey][key2])
                }
              }
            } else {
              console.log("Count not find task template", tasktemplate)
            }
          } else {
            console.log("Should have APPEND_stack in every task?")
          }

        }
      }
    }
    taskflowLookup[id] = taskflow;
    parent2id[taskflow.name] = id;
    // Build children data
    if (children[taskflow["parentId"]]) {
      children[taskflow["parentId"]].push(taskflow.id);
    } else {
      children[taskflow["parentId"]] = [taskflow.id];
    }
  });

  //console.log(JSON.stringify(taskflowLookup, null, 2))

  // For the menu building
  taskflows.forEach(function (taskflow) {
    if (children[taskflow.id]) {
      taskflowLookup[taskflow.id]["children"] = children[taskflow.id];
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
  if (userKey === "root") {
    continue;
  }
  if (users.hasOwnProperty(userKey)) {
    console.log("Creating group for user " + userKey)
    if (!groups[userKey]) {
      const group = {
        name: users[userKey].name,
        parentType: "root",
        users: [userKey],
      }
      groups.push(group)
    }
  }
}

//prepend root to all users in users of group
for (const groupKey in groups) {
  if (groups.hasOwnProperty(groupKey)) {
    const group = groups[groupKey];
    if (group.hasOwnProperty("users")) {
      group.users = group.users.map(function (userId) {
        if (!userId.startsWith("root.")) {
          userId = "root." + userId;
        }
        return userId;
      });
    }
  }
}

groups = utils.flattenObjects(groups);
//console.log(JSON.stringify(groups, null, 2))

//Add list of groups to each user (a view in a DB)
for (const groupKey in groups) {
  if (groups.hasOwnProperty(groupKey)) {
    if (groupKey === "root") {
      continue;
    }
    const group = groups[groupKey];
    assert(group.hasOwnProperty("users"), "Group " + groupKey + " has no users");
    group.users.forEach(function (userId) {
      if (!userId.startsWith("root.")) {
        userId = "root." + userId;

      }
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
            tasks[taskId]["parentId"] = taskflowKey;
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

export { users, groups, taskflows, tasktypes, tasks };
