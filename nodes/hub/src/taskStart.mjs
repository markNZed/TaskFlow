/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { tasksStore_async, groupsStore_async, usersStore_async, instancesStore_async, deleteActiveTask_async, getActiveTask_async, /*setActiveTask_async,*/ activeTaskNodesStore_async, activeNodeTasksStore_async, activeNodes, outputStore_async, familyStore_async } from "./storage.mjs";
import { v4 as uuidv4 } from "uuid";
import { utils } from "./utils.mjs";
import { NODE } from "../config.mjs";

// Test handling of error

// The async function taskStart_async is where the sequence for starting a task is managed.
// It makes use of many helper functions defined above it.

async function checkActiveTaskAsync(instanceId, activeNodes) {
  let activeTask = await getActiveTask_async(instanceId);
  let doesContain = false;
  if (activeTask) {
    let activeTaskNodes = await activeTaskNodesStore_async.get(instanceId)
    let environments = [];
    if (activeTaskNodes) {
      // For each of the nodes associated with this task
      // build a list of environments that are already active 
      for (let taskNodeId of activeTaskNodes) {
        const nodeData = activeNodes.get(taskNodeId);
        if (nodeData) {
          doesContain = true;
          environments.push(nodeData.environment);
          //console.log("Adding environment to task " + activeTask.id, nodeData.environment)
        }
      }
    }
    // Check that we have at least one environment active
    
    if (doesContain) {
      if (activeTask.environments && activeTask.environments.length > 0) {
        const allEnvironmentsPresent = activeTask.environments.every(env => environments.includes(env));
        //console.log("activeTask.environments:", activeTask.environments, "node environments:", environments, "allEnvironmentsPresent:", allEnvironmentsPresent);
        if (!allEnvironmentsPresent) {
          doesContain = false;
        }
      } else {
        console.error("activeTask.environments empty");
        doesContain = false;
      }
    }
  }
  return { activeTask, doesContain };
}

async function processInstanceAsync(task, instanceId, mode, nodeId) {
  utils.debugTask(task);
  let instance = await instancesStore_async.get(instanceId);
  if (instance) {
    let { activeTask, doesContain } = await checkActiveTaskAsync(instanceId, activeNodes);
    if (activeTask && doesContain) {
      utils.logTask(task, "Task already active", instanceId);
      task = activeTask;
      task.node = {};
      task.node["command"] = "join";
      task.node["commandArgs"] = { lockBypass: true };
      task.node["initiatingNodeId"] = nodeId;
      utils.logTask(task, `Joining ${mode} for ${task.id}`);
    } else {
      task = instance;
      //utils.logTask(task, "processInstanceAsync task", task);
      task.node["command"] = "init";
      // Assumes that we have a state entry
      task.state["current"] = "start";
      task.meta["updateCount"] = 0;
      task.meta["locked"] = null;
      await deleteActiveTask_async(instanceId);
      utils.logTask(task, `Restarting ${mode} ${instanceId} for ${task.id}`);
    }
  } else {
    utils.logTask(task, `Initiating ${mode} with instanceId ${instanceId}`);
  }
  return task;
}

async function checkUserGroup_async(groupId, userId) {
  const group = await groupsStore_async.get(groupId);
  if (!group?.users) {
    throw new Error("No users in group " + groupId);
  }
  if (!group?.users.includes(userId)) {
    throw new Error(`User ${userId} not in group ${groupId}`);
  } else {
    console.log("User in group", groupId, userId);
    return true;
  }
}

function isAllCaps(str) {
  return /^[A-Z\s]+$/.test(str);
}

async function processTemplateArrays_async(obj, task, outputs, familyId) {
  // Do substitution on arrays of strings and return a string
  if (Array.isArray(obj) && obj.every(item => typeof item === 'string')) {
    const user = await usersStore_async.get(task.user.id);
    return obj.reduce(function (acc, curr) {
      // Substitute variables with previous outputs
      const regex = /^([^\s.]+).*?\.([^\s.]+)$/;
      const matches = regex.exec(curr);
      //utils.logTask(task, "curr ", curr, " matches", matches)
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
        //utils.logTask(task, "Here ", outputPath, matches[2], outputs[outputPath][matches[2]])
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
        obj[key] = await processTemplateArrays_async(obj[key], task, outputs, familyId);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        await processTemplateArrays_async(obj[key], task, outputs, familyId);
      }
    }
  }
  return obj
}

async function processTemplates_async(task, obj, outputs, familyId) {
  if (!obj) {
    return task;
  }
  // Traverse every key-value pair in the object
  for (const [key, value] of Object.entries(obj)) {
    // If the value is an object, then recurse
    if (typeof value === 'object' && value !== null) {
      task = await processTemplates_async(task, value, outputs, familyId);
    }

    // If the key ends with "Template", process it
    if (key.endsWith('Template')) {
        const strippedKey = key.replace('Template', '');
        const templateCopy = utils.deepClone(value);
        obj[strippedKey] = await processTemplateArrays_async(templateCopy, task, outputs, familyId);
    }
  }
  return task;
}

async function checkUserPermissions_async(task, groupsStore_async, authenticate) {
  utils.debugTask(task);
  // Check if the user has permissions
  if (authenticate) {
    const [authenticated, groupId] = await utils.authenticatedTask_async(task, task.user.id, groupsStore_async);
    if (!authenticated) {
      console.error("Task:", utils.js(task));
      throw new Error("Task authentication failed");
    } else {
      task.groupId = groupId;
    }
  }
  return task;
}

async function updateFamilyStoreAsync(task, familyStore_async) {
  utils.debugTask(task);
  // Update familyStore_async
  if (task.familyId) {
    // If task.instanceId already exists then do nothing otherwise add instance to family
    let family = await familyStore_async.get(task.familyId) || {};
    const instanceIds = Object.values(family);
    if (!instanceIds) {
      family[task.id] = task.instanceId;
      await familyStore_async.set(task.familyId, family);
      utils.logTask(task, "Initiating family " + task.familyId + " with instanceId: " + task.instanceId);
    } else if (!instanceIds.includes(task.instanceId)) {
      family[task.id] = task.instanceId;
      await familyStore_async.set(task.familyId, family);
      utils.logTask(task, "Adding to family " + task.familyId + " instanceId: " + task.instanceId);
    } else {
      utils.logTask(task, "Instance already in family " + task.familyId + " instanceId: " + task.instanceId);
    }
  }
  return task;
}

async function updateTaskAndPrevTaskAsync(task, prevTask, nodeId, activeNodes/*, instancesStore_async, setActiveTask_async*/) {
  utils.debugTask(task);
  // Copy information from prevTask and update prevTask children
  if (prevTask) {
    // prevTask.meta.prevInstanceId is used so if a Node starts a task but that task completes and goes to 
    // nextTask on another node, then the originator can associate the task with it's original request
    task.meta["prevInstanceId"] = task?.meta?.prevInstanceId || prevTask?.meta?.prevInstanceId || prevTask.instanceId;
    task.meta["parentInstanceId"] = prevTask.instanceId;
    task.meta["errorHandlerInstanceId"] = prevTask?.meta?.errorHandlerInstanceId || task.meta.prevInstanceId;
    // Copying node information from previous task instance
    // In the case where the task sequence advances on another node 
    // we need to be able to associate more recent tasks with an older
    // task that is waiting on the next task.
    if (task.node["command"] !== "join") {
      task.nodes = prevTask.nodes;
      // Iterate over each node in task.nodes
      if (task.nodes) {
        Object.keys(task.nodes).forEach(key => {
          if (!task.nodes[key]) {
            throw new Error("Node " + key + " not found" + JSON.stringify(task, null, 2));
          }
          if (task.nodes[key].origTask) {
            delete task.nodes[key].origTask;
          }
        });
      }
      task.users = prevTask.users || {}; // Could be empty in the case of error task
      task.users[task.user.id] = task.users[task.user.id] || {};
      task.users[task.user.id]["tribe"] = prevTask.user.tribe;
      task.state.address = prevTask.state?.address ?? task.state.address;
      task.state.lastAddress = prevTask.state?.lastAddress ?? task.state.lastAddress;
    } else {
      task.nodes[nodeId] = activeNodes.get(nodeId);
    }
    /*
    // Update all the active prevTask with new child
    prevTask.meta.childrenInstanceId = prevTask.meta.childrenInstanceId ?? [];
    prevTask.meta.childrenInstanceId.push(task.instanceId);
    // We update the prevTask and set sourceNodeId to hub so all Nodes will be updated
    await instancesStore_async.set(prevTask.instanceId, prevTask);
    // The prevTask task may be "done" so no longer active
    // Also we do not want to update a task that errored
    if (!prevTask.done && !task.id.endsWith(".error")) {
      if (await getActiveTask_async(prevTask.instanceId)) {
        This has been removed for now becaus sending an update can impact the state machine
        and it is not intuitive. We need another way of managing the familyTree - TaskFamilyTree
        prevTask.node.command = "update";
        prevTask.node.sourceNodeId = NODE.id;
        await utils.nodeActiveTasksStoreSet_async(setActiveTask_async, prevTask);
        await taskSync_async(prevTask.instanceId, prevTask);
      }
    }
    */
  } else {
    task.meta["errorHandlerInstanceId"] = task.instanceId;
    task.nodes[nodeId] = activeNodes.get(nodeId);
  }
  return task;
}

async function supportMultipleLanguages_async(task, usersStore_async) {
  utils.debugTask(task);
  const user = await usersStore_async.get(task.user.id);
  const language = task?.config?.language || task?.config?.local?.language || user?.language || "EN";
  function processConfig(config, lang) {
    for (const [key, value] of Object.entries(config)) {
      // If it's an object (and not null or an array), recurse into it
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        processConfig(value, lang);
      }
      // If it's an array, loop through each element
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            processConfig(item, lang);
          }
        });
      }
      // Replace or create the key without the language code for both label and value
      if (typeof value === 'string' && key.endsWith("_" + lang.toUpperCase())) {
        const newKey = key.replace(/_\w{2}$/, "");
        if (config[newKey] === undefined) {
          config[newKey] = value;
        }
      }
    }
    // After processing all keys, remove language-specific keys
    Object.keys(config).forEach(key => {
      const match = key.match(/_(\w{2})$/);
      if (match && match[1].toUpperCase() === lang.toUpperCase()) {
        delete config[key];
      }
    });
  }
  processConfig(task.config, language);
  return task;
}

function allocateTaskToNodes(task, nodeId, activeNodes) {
  utils.debugTask(task);
  // Build list of nodes/environments that need to receive this task
  let taskNodes = []

  if (!task.environments) {
    console.error("No environments in task", task);
    throw new Error("No environments in task " + task.id);
  }

  utils.logTask(task, "task.environments", task.environments);

  // If the task only runs on coprocessor
  if (task.config.autoStartCoprocessor) {
    return [];
  }
  // Allocate the task to nodes that supports the environment(s) requested
  const sourceNode = activeNodes.get(nodeId);
  console.log(`allocateTaskToNodes ${nodeId} sourceNode Id`, nodeId);
  for (const environment of task.environments) {
    // Favor the source Node if we need that environment
    let found = false;
    if (sourceNode && sourceNode.environment === environment) {
      found = true;
      taskNodes.push(nodeId);
    }
    // If there are already node entries then favor these
    if (!found && task.nodes) {
      for (let id in task.nodes) {
        const node = activeNodes.get(id);
        if (node && node.environment === environment) {
          found = true;
          taskNodes.push(id);
          task.nodes[id] = node;
        }
      }
    }
    // Find an active node that supports this environment
    if (!found) {
      for (const [activeNodeId, value] of activeNodes.entries()) {
        if (value.environment === environment) {
            found = true;
            taskNodes.push(activeNodeId);
            task.nodes[activeNodeId] = value;
            break;
        }
      }       
    }
    if (!found) {
      console.warn("WARNING: No node found for environment " + environment);
      //throw new Error("No node found for environment " + environment);
    }
  }

  /*
  if (taskNodes.length == 0) {
    throw new Error("No nodes allocated for task " + task.id);
  }
  */

  utils.logTask(task, "Allocated new task " + task.id + " to nodes ", taskNodes);

  return taskNodes;
}

async function recordTasksAndNodesAsync(task, taskNodes, activeTaskNodesStore_async, activeNodeTasksStore_async) {
  utils.debugTask(task);
  // Record which nodes have this task
  let nodeIds;
  if (await activeTaskNodesStore_async.has(task.instanceId)) {
    nodeIds = await activeTaskNodesStore_async.get(task.instanceId);
    taskNodes.forEach(id => {
      if (nodeIds && !nodeIds.includes(id)) {
        nodeIds.push(id);
      } 
    });
  } else {
    nodeIds = taskNodes;
  }
  await activeTaskNodesStore_async.set(task.instanceId, nodeIds);
  //utils.logTask(task, "Nodes with task instance " + task.instanceId, nodeIds);
  // Record which tasks have this node
  await Promise.all(
    nodeIds.map(async (nodeId) => {
      let taskInstanceIds;
      if (await activeNodeTasksStore_async.has(nodeId)) {
        taskInstanceIds = await activeNodeTasksStore_async.get(nodeId);
        if (taskInstanceIds && !taskInstanceIds.includes(task.instanceId)) {
          taskInstanceIds.push(task.instanceId);
        }
      } else {
        taskInstanceIds = [task.instanceId];
      }
      await activeNodeTasksStore_async.set(nodeId, taskInstanceIds);
      //utils.logTask(task, "Added task instance " + task.instanceId + " to node " + nodeId);
    })
  );
}

async function taskStart_async(
    initTask,
    authenticate,
    nodeId,
    prevInstanceId,
  ) {

    // Could have a TaskEmpty if we do not want to base the task on a task config
    let task  = await tasksStore_async.get(initTask.id);
    if (!task) {
      throw new Error("Could not find task with id " + initTask.id)
    }

    utils.debugTask(task, `initTaskConfig ${nodeId}`);

    // Note that task.instanceId may change below due to task.config.oneFamily or task.config.collaborateGroupId
    task.instanceId = uuidv4();

    task = utils.deepMerge(task, initTask);

    // The task template may not have initialized some top level objects 
    ['config', 'input', 'masks', 'meta', 'output', 'privacy', 'node', 'nodes', 'request', 'response', 'state', 'user', 'users'].forEach(key => task[key] = task[key] || {});
    ['connections'].forEach(key => task[key] = task[key] || []);

    task = await checkUserPermissions_async(task, groupsStore_async, authenticate);

    let prevTask = prevInstanceId ? await instancesStore_async.get(prevInstanceId) : undefined;

    // Is this a user task being launched from a system task ?
    // If so then initialize a new familyId
    let isPrevSystemTask = false;
    let prevTaskFamilyId;
    if (prevTask) {
      isPrevSystemTask = prevTask.id.startsWith("root.system.");
      prevTaskFamilyId = prevTask.familyId;
    }
    let isFirstUserTask = false;
    if (isPrevSystemTask && task.id.startsWith("root.user.")) {
      isFirstUserTask = true;
    }
    if (isFirstUserTask) {
      prevTaskFamilyId = task.instanceId;
      utils.logTask(task, "Reinitialising familyId isFirstUserTask", prevTaskFamilyId);
    }

    // May be overwritten in processInstanceAsync
    task.node["command"] = "init";
       
    if (task.config.oneFamily) {
      // '.' is not used in keys or it breaks setNestedProperties
      // Maybe this could be added to schema
      task["instanceId"] = (task.id + "-" + task.user.id).replace(/\./g, '-');
      task.familyId = task.instanceId;
      task = await processInstanceAsync(task, task.instanceId, "oneFamily", nodeId);
    }

    if (initTask.groupId) {
      task.groupId = initTask.groupId;
      if (!await checkUserGroup_async(task.groupId, task.user.id)) {
        throw new Error("User " + task.user.id + " does not belong to initTask.groupId " + task.groupId);
      }
    // The task can specify the group through task.permissions 
    // then groupId will be set above by checkUserPermissions_async
    } else if (!task.groupId) {
      if (prevTask && prevTask.groupId) {
        task.groupId = prevTask.groupId;
      }
    } 
    
    if (task.config.collaborateGroupId) {
      // GroupId should be an array of group Ids?
      task.groupId = task.config.collaborateGroupId;
      if (await checkUserGroup_async(task.groupId, task.user.id)) {
        // '.' is not used in keys or it breaks setNestedProperties
        // Maybe this could be added to schema
        task["instanceId"] = (task.id + "-" + task.groupId).replace(/\./g, '-');
        task.familyId = task.instanceId;
        task = await processInstanceAsync(task, task.instanceId, "collaborate", nodeId);
      }
    }

    utils.debugTask(task, "after processInstanceAsync");

    if (!task.config.oneFamily && !task.config.collaborateGroupId) {
      // task.familyId may set by task.config.oneFamily or task.config.collaborateGroupId
      if (prevTask) {
        utils.logTask(task, "Using prev familyId", prevTaskFamilyId);
        task.familyId = prevTaskFamilyId;
        if (!task.familyId) {
          task.familyId = prevTaskFamilyId;
          utils.logTask(task, "No familyId in prevTask", prevTask);
          utils.logTask(task, "No familyId prevInstanceId", prevInstanceId);
        }
      } else if (initTask.familyId) { 
        utils.logTask(task, "Using init familyId", initTask.familyId);
        task.familyId = initTask.familyId;
      } else if (!task.familyId) {
        utils.logTask(task, "Using instanceId familyId", task.instanceId);
        task.familyId = task.instanceId;
      }
    }

    // Side-effect on task.familyd
    task = await updateFamilyStoreAsync(task, familyStore_async)

    // Initialize task.node.sourceNodeId
    task.node["id"] = NODE.id;
    task.node["sourceNodeId"] = task.node["sourceNodeId"] || nodeId;
    task.node["initiatingNodeId"] = task.node["initiatingNodeId"] || nodeId;
    task.node["coprocessed"] = false;
    task.node["commandDescription"] = task.commandDescription;
    
    // Initialize meta object
    // If already set (e.g. joining the task) keep the current values
    task.meta["requestsThisMinute"] = task.meta.requestsThisMinute ?? 0;
    task.meta["requestCount"] = task.meta.requestCount ?? 0;
    task.meta["createdAt"] = task.meta.createdAt ?? utils.updatedAt();
    task.meta["updatedAt"] = task.meta.updatedAt ?? utils.updatedAt();
    task.meta["updateCount"] = task.meta.updateCount ?? 0;
    task.meta["broadcastCount"] = task.meta.broadcastCount ?? 0;

    // When we join we want to keep the nodes info related to the joined task
    task = await updateTaskAndPrevTaskAsync(task, prevTask, nodeId, activeNodes/*, instancesStore_async, setActiveTask_async*/);

    let user = await usersStore_async.get(task.user.id);
    if (task.user) {
      //console.log("Starting with user", task.user, initTask);  
      user = utils.deepMerge(user, task.user);
    }
    if (task.users[task.user.id]) {
      task.users[task.user.id] = utils.deepMerge(task.users[task.user.id], user);
    } else {
      task.users[task.user.id] = user;
    }
    
    // This is only for task.config 
    task = await supportMultipleLanguages_async(task, usersStore_async);

    // Templating functionality
    const outputs = await outputStore_async.get(task.familyId) || {};
    // Using side-effects to update task.config
    task = await processTemplates_async(task, task.config, outputs, task.familyId);
    //task = await processTemplates_async(task, task.config.local, outputs, task.familyId);
    task = await processTemplates_async(task, task.services, outputs, task.familyId);
    task = await processTemplates_async(task, task.operations, outputs, task.familyId);
    task = await processTemplates_async(task, task.ceps, outputs, task.familyId);


    const taskNodes = allocateTaskToNodes(task, nodeId, activeNodes);

    await recordTasksAndNodesAsync(task, taskNodes, activeTaskNodesStore_async, activeNodeTasksStore_async);

    // Could mess up the join function ?
    task.meta.hash = utils.taskHash(task);

    task.node.origTask = utils.deepClone(task);

    task = utils.setMetaModified(task);

    utils.logTask(task, task.node.command, "id:", task.id, "familyId:", task.familyId);

    return task;
  }

  export default taskStart_async;