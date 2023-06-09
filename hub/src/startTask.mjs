/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { instancesStore_async, familyStore_async, activeTasksStore_async, activeTaskProcessorsStore_async, activeProcessors, outputStore_async } from "./storage.mjs";
import { users, groups, tasks } from "./configdata.mjs";
import { v4 as uuidv4 } from "uuid";
import { utils } from "./utils.mjs";

// Test handling of error

// The async function startTask_async is where the sequence for starting a task is managed.
// It makes use of many helper functions defined above it.

async function checkActiveTaskAsync(instanceId, activeProcessors) {
  let activeTask = await activeTasksStore_async.get(instanceId);
  let activeTaskProcessors = await activeTaskProcessorsStore_async.get(instanceId)
  let doesContain = false;
  if (activeTaskProcessors) {
    for (let key of activeProcessors.keys()) {
        if (activeTaskProcessors.includes(key)) {
            doesContain = true;
            break;
        }
    }
  }
  return { activeTask, doesContain };
}

async function processInstanceAsync(task, instanceId, mode) {
  let instance = await instancesStore_async.get(instanceId);
  if (instance) {
    let { activeTask, doesContain } = await checkActiveTaskAsync(instanceId, activeProcessors);
    if (activeTask && doesContain) {
      console.log("Task already active", instanceId);
      task = activeTask;
      task["hub"]["command"] = "join";
      console.log(`Joining ${mode} for ${task.id}`);
    } else {
      task = instance;
      task.state["current"] = "start";
      task.meta["updateCount"] = 0;
      task.meta["locked"] = null;
      await activeTasksStore_async.delete(instanceId);
      console.log(`Restarting ${mode} ${instanceId} for ${task.id}`);
    }
  } else {
    console.log(`Initiating ${mode} with instanceId ${instanceId}`);
  }
  return task;
}

function checkUserGroup(groupId, userId) {
  if (!groups[groupId]?.users) {
    throw new Error("No users in group " + groupId);
  }
  if (!groups[groupId].users.includes(userId)) {
    throw new Error(`User ${userId} not in group ${groupId}`);
  } else {
    console.log("User in group", groupId, userId);
    return true;
  }
}

function isAllCaps(str) {
  return /^[A-Z\s]+$/.test(str);
}

function processTemplateArrays(obj, task, outputs, familyId) {
  // Do substitution on arrays of strings and return a string
  if (Array.isArray(obj) && obj.every(item => typeof item === 'string')) {
    const user = users[task.userId];
    return obj.reduce(function (acc, curr) {
      // Substitute variables with previous outputs
      const regex = /^([^\s.]+).*?\.([^\s.]+)$/;
      const matches = regex.exec(curr);
      //console.log("curr ", curr, " matches", matches)
      if (matches && !isAllCaps(matches[1])) {
        const path = curr.split('.');
        let outputPath;
        if (path[0] === "root") {
          outputPath = curr.replace(/\.[^.]+$/, '');
        } else {
          outputPath = task.meta.parentId + "." + matches[1] + ".output";
        }
        if (outputs[outputPath] === undefined) {
          throw new Error("outputStore " + familyId + " " + outputPath + " does not exist")
        }
        if (outputs[outputPath][matches[2]] === undefined) {
          throw new Error("outputStore " + familyId + " " + outputPath + " output " + matches[2] + " does not exist in " + JSON.stringify(outputs[matches[1]]))
        }
        //console.log("Here ", outputPath, matches[2], outputs[outputPath][matches[2]])
        return acc.concat(outputs[outputPath][matches[2]]);
      } else {
        const regex = /^(USER)\.([^\s.]+)$/;
        const matches = regex.exec(curr);
        if (matches) {
          // Substitute variables with user data
          return acc.concat(user[matches[2]])
        } else {
          return acc.concat(curr);
        }
      }
    }, []).join("");
  } else {
    for (const key in obj) {
      if (Array.isArray(obj[key])) {
        obj[key] = processTemplateArrays(obj[key], task, outputs, familyId);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        processTemplateArrays(obj[key], task, outputs, familyId);
      }
    }
  }
  return obj
}

function processTemplates(task, obj, outputs, familyId) {
  // Traverse every key-value pair in the object
  for (const [key, value] of Object.entries(obj)) {
    // If the value is an object, then recurse
    if (typeof value === 'object' && value !== null) {
        processTemplates(task, value, outputs, familyId);
    }

    // If the key ends with "Template", process it
    if (key.endsWith('Template')) {
        const strippedKey = key.replace('Template', '');
        const templateCopy = JSON.parse(JSON.stringify(value));
        obj[strippedKey] = processTemplateArrays(templateCopy, task, outputs, familyId);
    }
  }
  return task;
}

function checkUserPermissions(task, groups, authenticate) {
  // Check if the user has permissions
  if (authenticate && !utils.authenticatedTask(task, task.userId, groups)) {
    throw new Error("Task authentication failed");
  }
}

async function updateFamilyStoreAsync(task, familyStore_async) {
  // Update familyStore_async
  if (task.familyId) {
    // If task.instanceId already exists then do nothing otherwise add instance to family
    let instanceIds = await familyStore_async.get(task.familyId);
    if (!instanceIds) {
      await familyStore_async.set(task.familyId, [task.instanceId]);
      console.log("Initiating family " + task.familyId + " with instanceId: " + task.instanceId);
    } else if (!instanceIds.includes(task.instanceId)) {
      instanceIds.push(task.instanceId);
      await familyStore_async.set(task.familyId, instanceIds);
      task.familyId = instanceId;
      console.log("Adding to family " + task.familyId + " instanceId: " + task.instanceId);
    } else {
      console.log("Instance already in family " + task.familyId + " instanceId: " + task.instanceId);
    }
  }
  return task;
}

async function updateTaskAndPrevTaskAsync(task, prevTask, processorId, instancesStore_async, activeTasksStore_async) {
  // Copy information from prevTask and update prevTask children
  if (prevTask) {
    task.meta["prevInstanceId"] = prevTask.instanceId;
    // Copying processor information from previous task instance
    // In the case where the task sequence advances on another processor 
    // we need to be able to associate a more recent tasks with an older
    // task that is waiting on the next task.
    task.processor = prevTask.processor;
    task.processor[processorId]["command"] = null;
    task.processor[processorId]["commandArgs"] = null;
    task.processor[processorId]["prevInstanceId"] = prevTask.instanceId;
    task.state.address = prevTask.state?.address ?? task.state.address;
    task.state.lastAddress = prevTask.state?.lastAddress ?? task.state.lastAddress;
    // Update all the active prevTask with new child
    prevTask.meta.childrenInstanceId = prevTask.meta.childrenInstanceId ?? [];
    prevTask.meta.childrenInstanceId.push(task.instanceId);
    // We update the prevTask and set sourceProcessorId to hub so all Processors will be updated
    await instancesStore_async.set(prevTask.instanceId, prevTask);
    // The prevTask task may be "done" so no longer active
    // Also we do not want to update a task that errored
    if (!prevTask.done && !task.id.endsWith(".error")) {
      if (await activeTasksStore_async.has(prevTask.instanceId)) {
        prevTask.hub.command = "update";
        prevTask.hub.sourceProcessorId = "hub";
        // This has the side effect of also updating the task
        await activeTasksStore_async.set(prevTask.instanceId, prevTask);
      }
    }
  }
  return task;
}

function supportMultipleLanguages(task, users) {
  // Multiple language support for config fields
  // Eventually replace with a standard solution
  // For example, task.config.demo_FR is moved to task.config.demo if user.language is FR
  const user = users[task.userId];
  const language = user.language || "EN";
  for (const [key, value] of Object.entries(task.config)) {
    if (key.endsWith("_" + language.toUpperCase())) {
      const newKey = key.replace(/_\w{2}$/, "");
      if (task.config[newKey] === undefined) {
        task.config[newKey] = value;
      }
    }
    // Strip out the language configs
    const match = key.match(/_(\w{2})$/);
    if (match) {
      delete task.config[key];
    }
  }
  return task;
}

function allocateTaskToProcessors(task, processorId, activeProcessors) {
  // Build list of processors/environments that need to receive this task
  let taskProcessors = []

  if (!task.environments) {
    throw new Error("No environments in task " + task.id);
  }

  //console.log("task.environments", task.environments);

  // Allocate the task to processors that supports the environment(s) requested
  const sourceProcessor = activeProcessors.get(processorId);
  for (const environment of task.environments) {
    // Favor the source Task Processor if we need that environment
    let found = false;
    if (sourceProcessor && sourceProcessor.environments && sourceProcessor.environments.includes(environment)) {
      found = true;
      taskProcessors.push(processorId);
    }
    // If there are already processor entries then favor these
    if (!found && task.processor) {
      for (let id in task.processor) {
        const processor = activeProcessors.get(id);
        if (processor && processor.environments && processor.environments.includes(environment)) {
          found = true;
          taskProcessors.push(id);
        }
      }
    }
    // Find an active processor that supports this environment
    if (!found) {
      for (const [activeProcessorId, value] of activeProcessors.entries()) {
        const environments = value.environments;
        if (environments && environments.includes(environment)) {
            found = true;
            taskProcessors.push(activeProcessorId);
            if (!task.processor[activeProcessorId]) {
              task.processor[activeProcessorId] = {};
            }
            break;
        }
      }       
    }
    if (!found) {
      throw new Error("No processor found for environment " + environment);
    }
  }

  if (taskProcessors.length == 0) {
    throw new Error("No processors allocated for task " + task.id);
  }

  console.log("Allocated new task " + task.id + " to processors ", taskProcessors);

  return taskProcessors;
}

async function recordTaskProcessorsAsync(task, taskProcessors, activeTaskProcessorsStore_async) {
  // Record which processors have this task
  if (await activeTaskProcessorsStore_async.has(task.instanceId)) {
    let processorIds = await activeTaskProcessorsStore_async.get(task.instanceId)
    taskProcessors.forEach(id => {
      if (processorIds && !processorIds.includes(id)) {
        processorIds.push(id);
      } 
    });
    await activeTaskProcessorsStore_async.set(task.instanceId, processorIds);
  } else {
    await activeTaskProcessorsStore_async.set(task.instanceId, taskProcessors);
  }
}

async function startTask_async(
    initTask,
    authenticate,
    processorId,
    prevInstanceId,
  ) {
    
    if (!tasks[initTask.id]) {
      throw new Error("Could not find task with id " + initTask.id)
    }

    // Instantiate new task
    let task = JSON.parse(JSON.stringify(tasks[initTask.id])); // deep copy

    //console.log("Task template", task)

    // Note that instanceId may change due to task.config.oneFamily or task.config.collaborateGroupId
    task.instanceId = uuidv4();

    task = utils.deepMerge(task, initTask);

    // The task template may not have initialized some top level objects 
    ['config', 'input', 'meta', 'output', 'privacy', 'processor', 'hub', 'request', 'response', 'state'].forEach(key => task[key] = task[key] || {});

    //console.log("Task after merge", task)

    checkUserPermissions(task, groups, authenticate)

    const prevTask = prevInstanceId ? await instancesStore_async.get(prevInstanceId) : undefined;
       
    if (task.config.oneFamily) {
      // '.' is not used in keys or it breaks setNestedProperties
      // Maybe this could be added to schema
      task["instanceId"] = (task.id + task.userId).replace(/\./g, '-');
      task.familyId = task.instanceId;
      task = await processInstanceAsync(task, task.instanceId, "oneFamily");
    }
    
    if (task.config.collaborateGroupId) {
      // GroupId should be an array of group Ids?
      task.groupId = task.config.collaborateGroupId;
      if (checkUserGroup(task.groupId, task.userId)) {
        // '.' is not used in keys or it breaks setNestedProperties
        // Maybe this could be added to schema
        task["instanceId"] = (task.id + task.groupId).replace(/\./g, '-');
        task.familyId = task.instanceId;
        task = await processInstanceAsync(task, task.instanceId, "collaborate");
      }
    }

    if (!task.config.oneFamily && !task.config.collaborateGroupId) {
      // task.familyId may set by task.config.oneFamily or task.config.collaborateGroupId
      if (prevTask) {
         console.log("Using prevInstanceId", prevTask.instanceId);
        task.familyId = prevTask.familyId;
      } else {
        task.familyId = initTask.familyId;
      }
    }

    // Side-effect on task.familyd
    task = await updateFamilyStoreAsync(task, familyStore_async)

    // Initialize task.hub.sourceProcessorId
    task.hub["command"] = task.hub.command ?? "start";
    task.hub.sourceProcessorId = processorId;
    
    // Initialize meta object
    task.meta.updateCount = task.meta.updateCount ?? 0;
    task.meta["requestsThisMinute"] = 0;
    task.meta["createdAt"] = task.meta["createdAt"] || Date.now();

    task = await updateTaskAndPrevTaskAsync(task, prevTask, processorId, instancesStore_async, activeTasksStore_async)

    // Set task.processor[processorId].id after copying info from prevTask
    task.processor[processorId] = task.processor[processorId] ?? {};
    task.processor[processorId].id = processorId;
    
    // This is only for task.config 
    task = supportMultipleLanguages(task, users);

    // Templating functionality
    const outputs = await outputStore_async.get(task.familyId);
    // Using side-effects to update task.config
    task = processTemplates(task, task.config, outputs, task.familyId);

    const taskProcessors = allocateTaskToProcessors(task, processorId, activeProcessors)

    await recordTaskProcessorsAsync(task, taskProcessors, activeTaskProcessorsStore_async)

    // This will also send the task to the processors
    activeTasksStore_async.set(task.instanceId, task);

    console.log("Started task id " + task.id, task.processor);
  }

  export default startTask_async;