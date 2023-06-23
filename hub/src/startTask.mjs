/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { instancesStore_async, threadsStore_async, activeTasksStore_async, activeTaskProcessorsStore_async, activeProcessors, outputStore_async } from "./storage.mjs";
import { users, groups, tasks } from "./configdata.mjs";
import { v4 as uuidv4 } from "uuid";
import { utils } from "./utils.mjs";
import { hubId } from "../config.mjs";

async function startTask_async(
    id,
    userId,
    authenticate,
    processorId,
    groupId,
    stackPtr = null,
    familyId = null,
    siblingTask = null,
    next = null, // indicated by presence of sbiling
  ) {
    /*
    console.log(
      "id:", id, 
      "userId:", userId, 
      "processorId:", processorId, 
      "groupId:", groupId, 
      "stackPtr:", stackPtr, 
      "familyId:", familyId,
      "next:", next
    );
    */    
    let instanceId = uuidv4();
    let siblingInstanceId;
    let prevInstanceId;
    let processor = {}

    if (siblingTask) {
      siblingInstanceId = siblingTask.instanceId;
      console.log("sibling instanceId", siblingInstanceId)
      familyId = siblingTask.familyId;
      // In the case where the thread advances on another processor 
      // we still need to be able to find the nextTask 
      prevInstanceId = siblingTask.instanceId
      // Need to fetch processors from sibling for prevInstance
      let instance = await instancesStore_async.get(prevInstanceId);
      processor = instance.processor;
      processor[processorId]["command"] = null;
      console.log("sibling processor", processor);
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

    if (typeof stackPtr !== "number") {
      taskCopy["stackPtr"] = taskCopy.stack.length;
    } else {
      taskCopy["stackPtr"] = stackPtr;
    }
    
    if (taskCopy.config?.oneThread && taskCopy["stackPtr"] === taskCopy.stack.length) {
      instanceId = (id + userId).replace(/\./g, '-'); // . is not used in keys or it breaks setNestedProperties
      familyId = instanceId;
      let instance = await instancesStore_async.get(instanceId);
      // There should be at max one instance
      if (instance) {
        // Check if the task is already active
        let activeTask = await activeTasksStore_async.get(instanceId);
        if (activeTask) {
          console.log("Task already active", instanceId);
          taskCopy = activeTask
          taskCopy["hub"]["command"] = "join";
          console.log("Joining oneThread for " + taskCopy.id)
        } else {
          taskCopy = instance
          taskCopy.state["current"] = "start";
          taskCopy.meta["updateCount"] = 0;
          // Delete so we restart with full task being synchronized
          // It would be better to do this only for the new processor
          await activeTasksStore_async.delete(instanceId);
          console.log(
            "Restarting oneThread " + instanceId + " for " + taskCopy.id
          )
        }
      } else {
        console.log("Initiating oneThread with instanceId " + instanceId)
      }
    }

    if (taskCopy.config?.collaborate && taskCopy["stackPtr"] === taskCopy.stack.length) {
      // Taskflow to choose the group (taskflow should include that)
      if (!groupId) {
        // This is a hack for the collaborate feature
        groupId = taskCopy.config.collaborate;
      }
      // Check if the user is in the group
      if (!groups[groupId].users.includes(userId)) {
        console.log("User not in group", groupId, userId);
        taskCopy["error"] = "User not in group";
        return taskCopy;
      } else {
        console.log("User in group", groupId, userId);
      }
      instanceId = (id + groupId).replace(/\./g, '-'); // . is not used in keys or it breaks setNestedProperties
      familyId = instanceId;
      let instance = await instancesStore_async.get(instanceId);
      // There should be at max one instance
      if (instance) {
        // Check if the task is already active
        let activeTask = await activeTasksStore_async.get(instanceId);
        if (activeTask) {
          console.log("Task already active", instanceId);
          taskCopy = activeTask
          taskCopy["hub"]["command"] = "join";
          console.log("Joining collaborate for " + taskCopy.id)
        } else {
          taskCopy = instance
          taskCopy.state["current"] = "start";
          taskCopy.meta["updateCount"] = 0;
          // Delete so we restart with full task being synchronized
          await activeTasksStore_async.delete(instanceId);
          console.log(
            "Restarting collaborate " + instanceId + " for " + taskCopy.id
          )
        }
      } else {
        console.log("Initiating collaborate with instanceId " + instanceId)
      }
    }

    if (!taskCopy.meta.updateCount) {
      taskCopy.meta["updateCount"] = 0;
    }

    // Must set familyId after oneThread, restoreSession and collaborate
    if (familyId) {
      taskCopy["familyId"] = familyId;
      // If instanceId already exists then do nothing otherwise add instance to thread
      let instanceIds = await threadsStore_async.get(familyId);
      if (!instanceIds) {
        await threadsStore_async.set(taskCopy["familyId"], [instanceId]);
        console.log("Initiating thread " + taskCopy["familyId"] + " with instanceId: " + instanceId)
      } else if (!instanceIds.includes(instanceId)) {
        instanceIds.push(instanceId);
        await threadsStore_async.set(taskCopy["familyId"], instanceIds);
        console.log("Adding to thread " + taskCopy["familyId"] + " instanceId: " + instanceId)
      } else {
        console.log("Instance already in thread " + taskCopy["familyId"] + " instanceId: " + instanceId)
      }
    } else {
      taskCopy["familyId"] = instanceId;
    }

    taskCopy.config = taskCopy.config || {};
    taskCopy.input = taskCopy.input || {};
    taskCopy.meta = taskCopy.meta || {};
    taskCopy.output = taskCopy.output || {};
    taskCopy.privacy = taskCopy.privacy || {};
    taskCopy.processor = taskCopy.processor || processor;
    taskCopy.hub = taskCopy.hub || {};
    taskCopy.request = taskCopy.request || {};
    taskCopy.response = taskCopy.response || {};
    taskCopy.state = taskCopy.state || {};

    if (!taskCopy["processor"][processorId]) {
      taskCopy["processor"][processorId] = {};
    }
    if (!taskCopy.hub?.command) {
      if (next) {
        taskCopy.hub.command = "next";
      } else {
        taskCopy.hub.command = "start";
      }
    }

    if (prevInstanceId !== undefined) {
      taskCopy.processor[processorId].prevInstanceId = prevInstanceId;
    }
    taskCopy.userId = userId;
    taskCopy.source = processorId;
    
    if (siblingInstanceId) {
      // Should rename to sibling?
      taskCopy.meta["parentInstanceId"] = siblingInstanceId;
      let parent = await instancesStore_async.get(siblingInstanceId);
      if (parent.request?.address) {
        taskCopy.request["address"] = parent.request.address;
      }
      if (!familyId) {
        familyId = parent.familyId;
      }
      // We start with the deepest component in the stack
      // This will not work with how we have stackPtr set earlier
      if (!taskCopy["stackPtr"]) {
        if (typeof stackPtr === "number") {
          taskCopy["stackPtr"] = stackPtr;
        } else if (parent?.stackPtr) {
          taskCopy["stackPtr"] = parent.stackPtr;
        } else if (taskCopy?.stack) {
          taskCopy["stackPtr"] = taskCopy.stack.length;
        }
      }
      if (
        !parent.hasOwnProperty("childrenInstances") ||
        !Array.isArray(parent.childrenInstances)
      ) {
        parent.childrenInstances = [];
      }
      parent.childrenInstances.push(instanceId);
      await instancesStore_async.set(siblingInstanceId, parent);
    }
    taskCopy.meta["createdAt"] = taskCopy.meta["createdAt"] || Date.now();

    const outputs = await outputStore_async.get(familyId);
    //console.log("outputs", outputs)

    // Templating functionality
    function isAllCaps(str) {
      return /^[A-Z\s]+$/.test(str);
    }
    function processTemplateArrays(obj, taskCopy, outputs, familyId) {
      // Do substitution on arrays of strings and return a string
      if (Array.isArray(obj) && obj.every(item => typeof item === 'string')) {
        const user = users[taskCopy.userId];
        return obj.reduce(function (acc, curr) {
          // Substitute variables with previous outputs
          const regex = /^([^\s.]+).*?\.([^\s.]+)$/;
          const matches = regex.exec(curr);
          //console.log("curr ", curr, " matches", matches)
          //root.collaborate.clientgenerator.conversation.chat.clientgenerator
          if (matches && !isAllCaps(matches[1])) {
            const path = curr.split('.');
            let outputPath;
            if (path[0] === "root") {
              outputPath = curr.replace(/\.[^.]+$/, '');
            } else {
              outputPath = taskCopy.meta.parentId + "." + matches[1];
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
            obj[key] = processTemplateArrays(obj[key], taskCopy, outputs, familyId);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            processTemplateArrays(obj[key], taskCopy, outputs, familyId);
          }
        }
      }
      return obj
    }

    
    const user = users[taskCopy.userId];
    const language = user.language || "EN";
    // Rename all the language specific configs
    for (const [key, value] of Object.entries(taskCopy.config)) {
      if (key.endsWith("_" + language.toUpperCase())) {
        const newKey = key.replace(/_\w{2}$/, "");
        if (taskCopy.config[newKey] === undefined) {
          taskCopy.config[newKey] = value;
          delete taskCopy.config[key];
        }
      }
      // Strip out the configs that do not have the right language
      const match = key.match(/_(\w{2})$/);
      if (match && match[1] !== language.toUpperCase()) {
        delete taskCopy.config[key];
      }
    }

     // Find all the config variable that end with Template
    for (const [key, template] of Object.entries(taskCopy.config)) {
      if (key.endsWith("Template")) {
        //console.log("Template found", key, template);
        const strippedKey = key.replace("Template", "");
        const templateCopy = JSON.parse(JSON.stringify(template)); // deep copy
        taskCopy.config[strippedKey] = processTemplateArrays(templateCopy, taskCopy, outputs, familyId);
        //console.log("Processed template", taskCopy.config[key]);
      }
    }

    // Must set instanceId after threadsStore_async
    taskCopy["instanceId"] = instanceId;

    // Build list of processesors that need to be notified about this task
    let taskProcessors = []

    // Deal with errors
    if (taskCopy.id.endsWith(".error")) {
      // Fetch the previous task
      const prevTask = await instancesStore_async.get(taskCopy.meta.parentInstanceId)
      const response = "ERROR: " + prevTask.error
      console.log("Set error from previous task", prevTask.id)
      taskCopy.response.text = response
      taskCopy.environments = prevTask.environments
      taskCopy.state.current = "error"
      //console.log("Error task", taskCopy)
    }

    if (!taskCopy.environments) {
      throw new Error("No environments in task " + taskCopy.id);
    }

    // Allocate the task to processors that supports the environment(s) requested
    const sourceProcessorId = taskCopy.source;
    const sourceProcessor = activeProcessors.get(sourceProcessorId);
    for (const environment of taskCopy.environments) {
      // Favor the source Processor if we need that environment
      let found = false;
      if (sourceProcessor && sourceProcessor.environments && sourceProcessor.environments.includes(environment)) {
        found = true;
        taskProcessors.push(sourceProcessorId);
        //console.log("Adding source processor " + sourceProcessorId + " to taskProcessors")
      }
      // Find an active processor that supports this environment
      if (!found) {
        //console.log("sourceProcessor did not match, now looking in activeProcessors")
        for (const [activeProcessorId, value] of activeProcessors.entries()) {
          const environments = value.environments;
          if (environments && environments.includes(environment)) {
              found = true;
              taskProcessors.push(activeProcessorId);
              if (!taskCopy.processor[activeProcessorId]) {
                taskCopy.processor[activeProcessorId] = {};
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
      throw new Error("No processors allocated for task " + taskCopy.id);
    }

    console.log("Allocated new task " + taskCopy.id + " to processors ", taskProcessors);

    // Record which processors have this task
    // Could convert this into asynchronous form
    if (await activeTaskProcessorsStore_async.has(taskCopy.instanceId)) {
      let processorIds = await activeTaskProcessorsStore_async.get(taskCopy.instanceId)
      taskProcessors.forEach(id => {
        if (processorIds && !processorIds.includes(id)) {
          processorIds.push(id);
        } 
      });
      activeTaskProcessorsStore_async.set(taskCopy.instanceId, processorIds);
    } else {
      activeTaskProcessorsStore_async.set(taskCopy.instanceId, taskProcessors);
    }
    activeTasksStore_async.set(taskCopy.instanceId, taskCopy);

    //console.log("New task processor ", taskCopy.processor)
    console.log("New task id " + taskCopy.id);
    return taskCopy;
  }

  export default startTask_async;