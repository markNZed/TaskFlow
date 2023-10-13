/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { tasksStore_async, groupsStore_async, usersStore_async, instancesStore_async, familyStore_async, deleteActiveTask_async, getActiveTask_async, /*setActiveTask_async,*/ activeTaskNodesStore_async, activeNodeTasksStore_async, activeNodes, outputStore_async } from "./storage.mjs";
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
      task.hub["command"] = "join";
      task.hub["commandArgs"] = { lockBypass: true };
      task.hub["initiatingNodeId"] = nodeId;
      utils.logTask(task, `Joining ${mode} for ${task.id}`);
    } else {
      task = instance;
      //utils.logTask(task, "processInstanceAsync task", task);
      task.hub["command"] = "init";
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
      await processTemplates_async(task, value, outputs, familyId);
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
    const authenticated = await utils.authenticatedTask_async(task, task.user.id, groupsStore_async);
    if (!authenticated) {
      throw new Error("Task authentication failed");
    }
  }
}

async function updateFamilyStoreAsync(task, familyStore_async) {
  utils.debugTask(task);
  // Update familyStore_async
  if (task.familyId) {
    // If task.instanceId already exists then do nothing otherwise add instance to family
    let instanceIds = await familyStore_async.get(task.familyId);
    if (!instanceIds) {
      await familyStore_async.set(task.familyId, [task.instanceId]);
      utils.logTask(task, "Initiating family " + task.familyId + " with instanceId: " + task.instanceId);
    } else if (!instanceIds.includes(task.instanceId)) {
      instanceIds.push(task.instanceId);
      await familyStore_async.set(task.familyId, instanceIds);
      utils.logTask(task, "Adding to family " + task.familyId + " instanceId: " + task.instanceId);
    } else {
      utils.logTask(task, "Instance already in family " + task.familyId + " instanceId: " + task.instanceId);
    }
  }
  if (task.meta.systemFamilyId) {
    let instanceIds = await familyStore_async.get(task.meta.systemFamilyId);
    if (instanceIds) {
      if (!instanceIds.includes(task.instanceId)) {
        instanceIds.push(task.instanceId);
        await familyStore_async.set(task.meta.systemFamilyId, instanceIds);
        utils.logTask(task, "Adding to systemFamilyId " + task.meta.systemFamilyId + " instanceId: " + task.instanceId);
      }
    } else {
      throw new Error("systemFamilyId " + task.meta.systemFamilyId + " not found");
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
    if (task.hub["command"] !== "join") {
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
      // With a coprocessor and an initial start command there is no instanceId
      // The nodes cannot be restored because there is no start task stored
      if (!prevTask.node) {
        task.node = activeNodes.get(nodeId);
      } else {
        task.node = prevTask.node;
        if (task.node.origTask) {
          delete task.node.origTask;
        }
      }
      task.users = prevTask.users || {}; // Could be mepty in the case of error task
      task.state.address = prevTask.state?.address ?? task.state.address;
      task.state.lastAddress = prevTask.state?.lastAddress ?? task.state.lastAddress;
    } else {
      task.node = activeNodes.get(nodeId);
    }
    task.node["command"] = null;
    task.node["commandArgs"] = null;
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
        prevTask.hub.command = "update";
        prevTask.hub.sourceNodeId = NODE.id;
        await utils.hubActiveTasksStoreSet_async(setActiveTask_async, prevTask);
        await taskSync_async(prevTask.instanceId, prevTask);
      }
    }
    */
  } else {
    task.meta["errorHandlerInstanceId"] = task.instanceId;
  }
  return task;
}

async function supportMultipleLanguages_async(task, usersStore_async) {
  utils.debugTask(task);
  // Multiple language support for config fields
  // Eventually replace with a standard solution
  // For example, task.config.demo_FR is moved to task.config.demo if user.language is FR
  const user = await usersStore_async.get(task.user.id);
  const language = user?.language || "EN";
  // Array of the objects
  let configs = [task.config];
  if (task.config?.local) {
    configs.push(task.config.local);
  }
  // Loop over the objects in the array
  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (key.endsWith("_" + language.toUpperCase())) {
        const newKey = key.replace(/_\w{2}$/, "");
        if (config[newKey] === undefined) {
          config[newKey] = value;
        }
      }
      // Strip out the language configs
      const match = key.match(/_(\w{2})$/);
      if (match) {
        delete config[key];
      }
    }
  }
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
  console.log(`allocateTaskToNodes ${nodeId} sourceNode`, sourceNode);
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
      console.error("No node found for environment " + environment);
      //throw new Error("No node found for environment " + environment);
    }
  }

  if (taskNodes.length == 0) {
    throw new Error("No nodes allocated for task " + task.id);
  }

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
    await activeTaskNodesStore_async.set(task.instanceId, nodeIds);
  } else {
    nodeIds = taskNodes;
    await activeTaskNodesStore_async.set(task.instanceId, taskNodes);
  }
  //utils.logTask(task, "Nodes with task instance " + task.instanceId, nodeIds);
  // Record which tasks have this node
  await Promise.all(
    nodeIds.map(async (nodeId) => {
      if (await activeNodeTasksStore_async.has(nodeId)) {
        let taskInstanceIds = await activeNodeTasksStore_async.get(nodeId);
        if (taskInstanceIds && !taskInstanceIds.includes(task.instanceId)) {
          taskInstanceIds.push(task.instanceId);
        }
        await activeNodeTasksStore_async.set(nodeId, taskInstanceIds);
      } else {
        await activeNodeTasksStore_async.set(nodeId, [task.instanceId]);
      }
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
    ['config', 'input', 'meta', 'output', 'privacy', 'node', 'nodes', 'hub', 'request', 'response', 'state', 'users'].forEach(key => task[key] = task[key] || {});

    await checkUserPermissions_async(task, groupsStore_async, authenticate);

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
    if (isFirstUserTask && prevTaskFamilyId) {
      task.meta["systemFamilyId"] = prevTaskFamilyId; // Assumes it was launched from a system task
    }
    if (isFirstUserTask) {
      prevTaskFamilyId = task.instanceId;
      utils.logTask(task, "Reinitialising familyId isFirstUserTask", prevTaskFamilyId);
    }

    let isFirstSystemTask = false;
    if (!prevTask && task.id.startsWith("root.system.")) {
      isFirstSystemTask = true;
    }

    // We need a shared familyId so task.shared works between system tasks
    if (isFirstSystemTask) {
      task.familyId = "system";
      utils.logTask(task, "isFirstSystemTask setting familyId to", task.familyId);
    }

    // May be overwritten in processInstanceAsync
    task.hub["command"] = "init";
       
    if (task.config.oneFamily) {
      // '.' is not used in keys or it breaks setNestedProperties
      // Maybe this could be added to schema
      task["instanceId"] = (task.id + "-" + task.user.id).replace(/\./g, '-');
      task.familyId = task.instanceId;
      task = await processInstanceAsync(task, task.instanceId, "oneFamily", nodeId);
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

    // Initialize task.hub.sourceNodeId
    task.hub["id"] = NODE.id;
    task.hub["sourceNodeId"] = task.hub["sourceNodeId"] || nodeId;
    task.hub["initiatingNodeId"] = task.hub["initiatingNodeId"] || nodeId;
    task.hub["coprocessed"] = false;
    task.hub["commandDescription"] = task.commandDescription;
    
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
    // Set task.node.id after copying info from prevTask
    task.nodes[nodeId] = task.nodes[nodeId] ?? {};
    task.nodes[nodeId] = task.node;

    const user = await usersStore_async.get(task.user.id);
    if (task.users[task.user.id]) {
      task.users[task.user.id] = utils.deepMerge(task.users[task.user.id], user);
    } else {
      task.users[task.user.id] = user;
    }
    
    // This is only for task.config 
    task = await supportMultipleLanguages_async(task, usersStore_async);

    // Templating functionality
    const outputs = await outputStore_async.get(task.familyId);
    // Using side-effects to update task.config
    task = await processTemplates_async(task, task.config, outputs, task.familyId);
    task = await processTemplates_async(task, task.config.local, outputs, task.familyId);

    const taskNodes = allocateTaskToNodes(task, nodeId, activeNodes);

    await recordTasksAndNodesAsync(task, taskNodes, activeTaskNodesStore_async, activeNodeTasksStore_async);

    // Could mess up the join function ?
    task.meta.hash = utils.taskHash(task);

    task.hub.origTask = utils.deepClone(task);

    task = utils.setMetaModified(task);

    utils.logTask(task, task.hub.command, "id:", task.id, "familyId:", task.familyId);

    return task;
  }

  export default taskStart_async;