/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "./utils.mjs";
import {} from "./../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();

// For now we use JS data structures instead of a DB
// Removes need for an admin interface during dev
const CONFIG_DIR = process.env.CONFIG_DIR || "./../config-v02/";
console.log("Loading config data from " + CONFIG_DIR);
var users = await utils.load_data_async(CONFIG_DIR, "users");
var groups = await utils.load_data_async(CONFIG_DIR, "groups");
var workflows = await utils.load_data_async(CONFIG_DIR, "workflows");
var components = await utils.load_data_async(CONFIG_DIR, "components");
var agents = await utils.load_data_async(CONFIG_DIR, "agents");
var defaults = await utils.load_data_async(CONFIG_DIR, "defaults");
var tasks = {}; // We will build this from workflows

// We adopt a DRY strategy in the code and config files
// But not in the data structures that are generated from the config for the code
// Transform hierarchical workflows structure into a hash
// Build tasks hash from the workflows hash

// Not that this has huge side-effects
// Transform workflows array into flattened workflows hash
// We should introduce a concept of appending and prepending
// e.g. PREPEND_property would prepend the content to content form higher level instead of replacing content
// Functionality added but not tested
function flattenObjects(workflows) {
  // The default level is named 'root'
  var parent2id = { root: "" };
  var children = {};
  const regex_lowercase = /^[a-z]+$/;
  var workflowLookup = {};
  workflows.forEach(function (workflow) {
    //console.log("Workflow: " + workflow?.name)
    if (!workflow?.name) {
      utils.fail("Error: Workflow missing name");
    }
    if (!workflow?.parentType && workflow.name !== "root") {
      utils.fail("Error: Workflow missing parentType " + workflow.name);
    }
    /* Removed so we can have component names
    if (!regex_lowercase.test(workflow.name)) {
      utils.fail('Error: Workflow name should only include lowercase characters ' + workflow.name)
    }
    */
    if (!parent2id[workflow.parentType] && workflow.name !== "root") {
      utils.fail(
        "Error: Workflow parentType " +
          workflow.parentType +
          " does not exist in " +
          workflow.name
      );
    }
    var id;
    if (workflow.name === "root") {
      id = "root";
    } else {
      id = parent2id[workflow.parentType] + "." + workflow.name;
    }
    if (workflowLookup[id]) {
      utils.fail("Error: Duplicate workflow " + id);
    }
    // Add id to each task
    if (workflow?.tasks) {
      for (const key in workflow.tasks) {
        if (workflow.tasks.hasOwnProperty(key)) {
          workflow.tasks[key]["name"] = key;
          workflow.tasks[key]["id"] = id + "." + key;
          // Avoid the task inheriting the label from the Workflow
          if (!workflow.tasks[key]["label"]) {
            workflow.tasks[key]["label"] = "";
          }
          // Convert relative task references to absolute
          if (
            workflow.tasks[key]["nextTask"] &&
            !workflow.tasks[key]["nextTask"].includes(".")
          ) {
            workflow.tasks[key]["nextTask"] =
              id + "." + workflow.tasks[key]["nextTask"];
          }
          if (
            workflow.tasks[key]["config"] &&
            workflow.tasks[key]["config"]["nextStateTemplate"]
          ) {
            let nt = workflow.tasks[key]["config"]["nextStateTemplate"];
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
    if (!workflow.config) {
      workflow['config'] = {}
    }
    if (!workflow.config?.label) {
      workflow.config["label"] = utils.capitalizeFirstLetter(workflow.name);
    }
    workflow["id"] = id;
    workflow["parentId"] = parent2id[workflow.parentType];
    // Copy all the keys from the parentType that are not in the current workflow
    // Could create functions here for PREPEND_ and APPEND_
    const parentWorkflow = workflowLookup[workflow["parentId"]];
    for (const key in parentWorkflow) {
      if (parentWorkflow.hasOwnProperty(key)) {
        if (
          !workflow.hasOwnProperty(key) &&
          !key.startsWith("APPEND_") &&
          !key.startsWith("PREPEND_")
        ) {
          workflow[key] = parentWorkflow[key];
        }
        if (workflow.hasOwnProperty("PREPEND_" + key)) {
          if (Array.isArray(workflow["PREPEND_" + key])) {
            workflow[key] = workflow["PREPEND_" + key].concat(
              parentWorkflow[key]
            );
          } else {
            workflow[key] = workflow["PREPEND_" + key] + parentWorkflow[key];
          }
          //console.log("Workflow " + workflow.id + " PREPEND_ ", workflow['PREPEND_' + key], " to " + key)
        }
        if (workflow.hasOwnProperty("APPEND_" + key)) {
          if (Array.isArray(workflow["APPEND_" + key])) {
            workflow[key] = parentWorkflow[key].concat(
              workflow["APPEND_" + key]
            );
          } else {
            workflow[key] = parentWorkflow[key] + workflow["APPEND_" + key];
          }
          //console.log("Workflow " + workflow.id + " APPEND_ ", workflow['APPEND_' + key], " to " + key)
        }
      }
    }
    // Copy all the keys from the workflow that are not in the current tasks
    if (workflow?.tasks) {
      for (const taskkey in workflow.tasks) {
        if (workflow.tasks.hasOwnProperty(taskkey)) {
          for (const workflowkey in workflow) {
            if (workflow.hasOwnProperty(workflowkey)) {
              if (
                !workflow.tasks[taskkey].hasOwnProperty(workflowkey) &&
                workflowkey !== "tasks" &&
                !workflowkey.startsWith("APPEND_") &&
                !workflowkey.startsWith("PREPEND_")
              ) {
                workflow.tasks[taskkey][workflowkey] = workflow[workflowkey];
                if (
                  workflow.tasks[taskkey].hasOwnProperty(
                    "PREPEND_" + workflowkey
                  )
                ) {
                  if (
                    Array.isArray(
                      workflow.tasks[taskkey]["PREPEND_" + workflowkey]
                    )
                  ) {
                    workflow.tasks[taskkey][workflowkey] = workflow.tasks[
                      taskkey
                    ]["PREPEND_" + workflowkey].concat(workflow[workflowkey]);
                  } else {
                    workflow.tasks[taskkey][workflowkey] =
                      workflow.tasks[taskkey]["PREPEND_" + workflowkey] +
                      workflow[workflowkey];
                  }
                } else if (
                  workflow.tasks[taskkey].hasOwnProperty(
                    "APPEND_" + workflowkey
                  )
                ) {
                  if (
                    Array.isArray(
                      workflow.tasks[taskkey]["APPEND_" + workflowkey]
                    )
                  ) {
                    workflow.tasks[taskkey][workflowkey] = workflow[
                      workflowkey
                    ].concat(workflow.tasks[taskkey]["APPEND_" + workflowkey]);
                  } else {
                    workflow.tasks[taskkey][workflowkey] =
                      workflow[workflowkey] +
                      workflow.tasks[taskkey]["APPEND_" + workflowkey];
                  }
                }
              }
            }
          }
        }
      }
    }
    workflowLookup[id] = workflow;
    parent2id[workflow.name] = id;
    // Build children data
    if (children[workflow["parentId"]]) {
      children[workflow["parentId"]].push(workflow.id);
    } else {
      children[workflow["parentId"]] = [workflow.id];
    }
  });

  //console.log(JSON.stringify(workflowLookup, null, 2))

  // For the menu building
  workflows.forEach(function (workflow) {
    if (children[workflow.id]) {
      workflowLookup[workflow.id]["children"] = children[workflow.id];
    }
  });

  // Replace array of workflows with hash
  // Array just made it easier for the user to specify parents in the config file
  return workflowLookup;
}

// This has side-effects, modifying workflows in-place
// Could check that each workflow has a 'start' task
workflows = flattenObjects(workflows);
//console.log(JSON.stringify(workflows, null, 2))

components = flattenObjects(components);
//console.log(JSON.stringify(components, null, 2))

//Create a group for each user
for (const userKey in users) {
  if (users.hasOwnProperty(userKey)) {
    if (!groups[userKey]) {
      groups[userKey] = {};
      groups[userKey]["name"] = users[userKey].name;
      groups[userKey]["users"] = [userKey];
    }
  }
}

// Adding key of object as id in object
function add_index(config) {
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      config[key]["id"] = key;
    }
  }
}

// Add id to groups (index in DB)
add_index(groups);
//console.log(JSON.stringify(groups, null, 2))

// Add id to users (index in DB)
add_index(users);
//console.log(JSON.stringify(users, null, 2))

// Add id to agents (index in DB)
add_index(agents);
//console.log(JSON.stringify(users, null, 2))

//Add list of groups to each user (a view in a DB)
for (const groupKey in groups) {
  if (groups.hasOwnProperty(groupKey)) {
    const group = groups[groupKey];
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

// Flatten the hash of tasks from workflows
// Add the parentId to task objects
function flattenTasks(workflows) {
  const tasks = {};
  for (const workflowKey in workflows) {
    if (Object.prototype.hasOwnProperty.call(workflows, workflowKey)) {
      const workflowTasks = workflows[workflowKey].tasks;
      if (workflowTasks) {
        for (const taskKey in workflowTasks) {
          if (Object.prototype.hasOwnProperty.call(workflowTasks, taskKey)) {
            const task = workflows[workflowKey].tasks[taskKey];
            const taskId = task.id;
            if (!taskId) {
              console.log("taskID not set " + taskKey + " " + workflowKey);
            }
            tasks[taskId] = task;
            tasks[taskId]["parentId"] = workflowKey;
            //tasks[taskId]['filter_for_client'] = workflows[workflowKey].filter_for_client;
          }
        }
      }
    }
  }
  return tasks;
}

tasks = flattenTasks(workflows);
//console.log(JSON.stringify(tasks, null, 2))

export { users, groups, workflows, components, agents, defaults, tasks };
