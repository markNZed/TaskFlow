/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { instancesStore_async, threadsStore_async } from "./storage.mjs";
import { groups, tasks } from "./configdata.mjs";
import { v4 as uuidv4 } from "uuid";
import { utils } from "./utils.mjs";

async function newTask_async(
    id,
    userId,
    authenticate,
    source,
    groupId,
    sessionId,
    component_depth = null,
    threadId = null,
    siblingTask = null
  ) {
    //console.log("newTask_async", id, userId, source, sessionId, groupId, component_depth, threadId);
    let siblingInstanceId;
    if (siblingTask) {
      siblingInstanceId = siblingTask.instanceId;
      threadId = siblingTask.threadId;
    }
    if (!tasks[id]) {
      console.log("ERROR could not find task with id", id)
    }
    let taskCopy = { ...tasks[id] };
    //console.log("taskCopy", taskCopy)
    // Check if the user has permissions
    if (authenticate && !utils.authenticatedTask(taskCopy, userId, groups)) {
      console.log("Task authentication failed", taskCopy.id, userId);
      taskCopy["error"] = "Task authentication failed";
      return taskCopy;
    }

    if (!taskCopy?.config) {
      taskCopy["config"] = {};
    }
    if (!taskCopy?.input) {
      taskCopy["input"] = {};
    }
    if (!taskCopy?.output) {
      taskCopy["output"] = {};
    }
    if (!taskCopy?.privacy) {
      taskCopy["privacy"] = {};
    }
    if (!taskCopy?.request) {
      taskCopy["request"] = {};
    }
    if (!taskCopy?.response) {
      taskCopy["response"] = {};
    }
    if (!taskCopy?.state) {
      taskCopy["state"] = {};
    }
    taskCopy["userId"] = userId;
    taskCopy["source"] = source;
    taskCopy["sessionId"] = sessionId;
    let instanceId = uuidv4();
    taskCopy["instanceId"] = instanceId;
    if (siblingInstanceId) {
      // Should reanme to sibling?
      taskCopy["parentInstanceId"] = siblingInstanceId;
      let parent = await instancesStore_async.get(siblingInstanceId);
      if (parent.request?.address) {
        taskCopy.request["address"] = parent.request.address;
      }
      if (!threadId) {
        threadId = parent.threadId;
      }
      // We start with the deepest component in the stack
      if (typeof component_depth === "number") {
        taskCopy["stackPtr"] = component_depth;
      } else if (parent?.stackPtr) {
        taskCopy["stackPtr"] = parent.stackPtr;
      } else if (taskCopy?.stack) {
        taskCopy["stackPtr"] = taskCopy.stack.length;
      }
      if (
        !parent.hasOwnProperty("childrenInstances") ||
        !Array.isArray(parent.childrenInstances)
      ) {
        parent.childrenInstances = [];
      }
      parent.childrenInstances.push(instanceId);
      await instancesStore_async.set(siblingInstanceId, parent);
    } else if (taskCopy?.stack) {
      // Note component_depth may be modified in api/task/start
      taskCopy["stackPtr"] = taskCopy.stack.length;
    }
    if (threadId) {
      taskCopy["threadId"] = threadId;
      let instanceIds = await threadsStore_async.get(threadId);
      if (instanceIds) {
        instanceIds.push(instanceId);
      } else {
        instanceIds = [instanceId];
      }
      await threadsStore_async.set(threadId, instanceIds);
    } else {
      taskCopy["threadId"] = instanceId;
      await threadsStore_async.set(instanceId, [instanceId]);
    }
    taskCopy["createdAt"] = Date.now();
    await instancesStore_async.set(instanceId, taskCopy);

    

    if (taskCopy.config?.oneThread) {
      const threadId = id + userId;
      let instanceIds = await threadsStore_async.get(threadId);
      if (instanceIds) {
        // Returning last so continuing (maybe should return first?)
        const instanceId = instanceIds[instanceIds.length - 1];
        taskCopy = await instancesStore_async.get(instanceId);
        console.log(
          "Restarting one_thread " + instanceId + " for " + taskCopy.id
        );
      } else {
        taskCopy.threadId = threadId
      }
    }
    
    if (taskCopy.config?.restoreSession) {
      const threadId = id + sessionId;
      let instanceIds = await threadsStore_async.get(threadId);
      if (instanceIds) {
        // Returning last so continuing (maybe should return first?)
        const instanceId = instanceIds[instanceIds.length - 1];
        taskCopy = await instancesStore_async.get(instanceId);
        console.log("Restarting session " + instanceId + " for " + taskCopy.id);
      } else {
        taskCopy.threadId = threadId
      }
    }

    if (taskCopy.config?.collaborate) {
      // Taskflow to choose the group (taskflow should include that)
      if (!groupId) {
        // This is a hack for the collaborate feature
        groupId = taskCopy.config.collaborate;
      }
      const threadId = id + groupId;
      let instanceIds = await threadsStore_async.get(threadId);
      if (instanceIds) {
        // Returning last so continuing (maybe should return first?)
        const instanceId = instanceIds[instanceIds.length - 1];
        taskCopy = await instancesStore_async.get(instanceId);
        console.log(
          "Restarting collaboration " + instanceId + " for " + taskCopy.id
        );
      } else {
        taskCopy.threadId = threadId
      }
    }

    //console.log("New task ", taskCopy)
    console.log("New task id " + taskCopy.id);
    return taskCopy;
  }

  export default newTask_async;