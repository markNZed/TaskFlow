/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { instancesStore_async, threadsStore_async, activeTasksStore_async, activeProcessorsStore_async, sessionsStore_async, activeProcessors, outputStore_async } from "./storage.mjs";
import { groups, tasks } from "./configdata.mjs";
import { v4 as uuidv4 } from "uuid";
import { utils } from "./utils.mjs";

async function newTask_async(
    id,
    userId,
    authenticate,
    source,
    processorId,
    sessionId,
    groupId,
    component_depth = null,
    threadId = null,
    siblingTask = null
  ) {
    /*
    console.log(
      "id:", id, 
      "userId:", userId, 
      "source:", source, 
      "processorId:", processorId, 
      "sessionId:", sessionId, 
      "groupId:", groupId, 
      "component_depth:", component_depth, 
      "threadId:", threadId
    );
    */    
    let siblingInstanceId;
    let prevInstanceId = null;
    let newThread = false;
    if (siblingTask) {
      siblingInstanceId = siblingTask.instanceId;
      threadId = siblingTask.threadId;
      // In the case where the thread advances on anohter processor 
      // we still need to be able to find the nextTask 
      if (siblingTask.prevInstanceId) {
        prevInstanceId = siblingTask.prevInstanceId
      } else {
        prevInstanceId = {}
      }
      prevInstanceId[processorId] = siblingTask.instanceId
    }
    if (!threadId) {
      newThread = true;
    }
    if (!tasks[id]) {
      console.log("ERROR could not find task with id", id)
    }
    let taskCopy = JSON.parse(JSON.stringify(tasks[id])); // deep copy
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
    taskCopy["prevInstanceId"] = prevInstanceId 
    taskCopy["userId"] = userId;
    taskCopy["source"] = source;
    taskCopy["newSource"] = processorId;
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

    const outputs = await outputStore_async.get(threadId);

    if (!newThread && taskCopy.config?.promptTemplate) {
      console.log("promptTemplate", taskCopy.config.promptTemplate)
      let filledPromptTemplate = "";
      filledPromptTemplate += taskCopy.config.promptTemplate.reduce(function (acc, curr) {
        // Currently this assumes the parts are from the same taskflow, could extend this
        const regex = /(^.+)\.(.+$)/;
        const matches = regex.exec(curr);
        if (matches) {
          // We need to find the relevant task using the threadId ?
          // like taskflow key: threadId + taskId
          // console.log("matches task " + matches[1] + " " + matches[2])
          const outputPath = taskCopy.parentId + "." + matches[1]
          if (outputs[outputPath] === undefined) {
            throw new Error("outputStore " + threadId + " " + outputPath + " does not exist")
          }
          if ( outputs[outputPath][matches[2]] === undefined ) {
            throw new Error("outputStore " + threadId + " " + outputPath + " output " + matches[2] + " does not exist in " + JSON.stringify(outputs[matches[1]]))
          }
          return (
            acc + outputs[outputPath][matches[2]]
          );
        } else {
          return acc + curr;
        }
      });
      console.log("filledPromptTemplate " + filledPromptTemplate)
      taskCopy.config.promptTemplate = filledPromptTemplate;
    }

    // Should align coding style with promptTemplate
    if (!newThread && taskCopy.config?.messagesTemplate) {
      let filledMessagesTemplate = "";
      // assemble
      taskCopy.config.messagesTemplate.forEach((message) => {
        if (Array.isArray(message["content"])) {
          message["content"] = message["content"].reduce(function (acc, curr) {
            // Currently this assumes the tasks are from the same taskflow, could extend this
            const regex = /(^.+)\.(.+$)/;
            const matches = regex.exec(curr);
            if (matches) {
              const outputPath = taskCopy.parentId + "." + matches[1]
              let substituted = outputs[outputPath][matches[2]]
              return acc + substituted;
            } else {
              if (typeof curr === "string") {
                return acc + curr;
              } else {
                return acc + JSON.stringify(curr);
              }
            }
          });
        }
      });
    }

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
        console.log("Continuing one_thread " + threadId)
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
        console.log("Restoring session " + threadId)
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
        console.log("Collaborating on " + threadId)
      }
    }

    // Build list of processesors that need to be notified about this task
    let taskProcessors = []

    // Deal with errors
    if (taskCopy.id.endsWith(".error")) {
      // Fetch the previous task
      const prevTask = await instancesStore_async.get(taskCopy.parentInstanceId)
      const response = "ERROR: " + prevTask.error
      console.log("Set error from previous task", prevTask.id)
      taskCopy.response.text = response
      taskCopy.environments = prevTask.environments
      //console.log("Error task", taskCopy)
    }

    // Get the list of processors in the session
    const sessionsStoreId = sessionId + "_processors";
    let sessionProcessors = [];
    if (await sessionsStore_async.has(sessionsStoreId)) {
      sessionProcessors = await sessionsStore_async.get(sessionsStoreId);
    } else {
      throw new Error("No processors in session " + sessionId);
    }

    if (!taskCopy.environments) {
      throw new Error("No environments in task " + taskCopy.id);
    }

    // Allocate the task to processors that supports the environment(s) requested
    for (const environment of taskCopy.environments) {
      // All the session processors with this environment should be included
      // This could deal with multiple browsers in the same session.
      //console.log("Looking for sessionProcessors with environment ", environment)
      let found = false;
      if (!found) {
        for (const sessionProcessorId of sessionProcessors) {
          //console.log("sessionProcessor ", sessionProcessorId)
          const activeProcessor = activeProcessors.get(sessionProcessorId)
          if (activeProcessor) {
            const environments = activeProcessor.environments;
            if (environments && environments.includes(environment)) {
              found = true;
              taskProcessors.push(sessionProcessorId);
              //console.log("Adding processor " + sessionProcessorId + " to session")
            }
          } else {
            console.log("No active processor for ", sessionProcessorId)
          }
        }
      }
      // Find an active processor that supports this environment and add it to the session
      if (!found) {
        //console.log("sessionProcessors did not match, now looking in activeProcessors")
        for (let [activeProcessorId, value] of activeProcessors) {
          //console.log("activeProcessor ", activeProcessorId, value);
          const environments = value.environments;
          if (environments && environments.includes(environment)) {
            sessionProcessors.push(activeProcessorId);
            //console.log("Adding processor " + activeProcessorId + " to session " + sessionId, sessionProcessors)
            await sessionsStore_async.set(sessionsStoreId, sessionProcessors);
            found = true;
            taskProcessors.push(activeProcessorId);
            break
          }
        }
      }
    }

    if (taskProcessors.length == 0) {
      throw new Error("No processors allocated for task " + taskCopy.id);
    }

    console.log("Allocated new task " + taskCopy.id + " to processors " + taskProcessors);

    // Record which processors have this task
    // Could convert this into asynchronous form
    let activeTask;
    if (await activeProcessorsStore_async.has(taskCopy.instanceId)) {
      let processorIds = await activeProcessorsStore_async.get(taskCopy.instanceId)
      taskProcessors.forEach(id => {
        if (processorIds && !processorIds.includes(id)) {
          processorIds.push(id);
        } 
      });
      activeProcessorsStore_async.set(taskCopy.instanceId, processorIds);
    } else {
      activeProcessorsStore_async.set(taskCopy.instanceId, taskProcessors);
    }
    activeTasksStore_async.set(taskCopy.instanceId, taskCopy);

    //console.log("New task ", taskCopy)
    console.log("New task id " + taskCopy.id);
    return taskCopy;
  }

  export default newTask_async;