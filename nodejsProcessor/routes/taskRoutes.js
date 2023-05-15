/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { v4 as uuidv4 } from "uuid";
import { utils } from "../src/utils.mjs";
import { taskFunctions } from "../Task/taskFunctions.mjs";
import { groups, tasks, tasktemplates } from "../src/configdata.mjs";
import { instancesStore_async, threadsStore_async } from "../src/storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { toTask, fromTask } from "../src/taskConverterWrapper.mjs";

const router = express.Router();

async function do_task_async(task) {
  let updated_task = {};
  let idx = 0;
  if (task?.stackPtr) {
    idx = task.stackPtr - 1;
    console.log("Component ", task.stack, " idx ", idx);
  }
  if (taskFunctions.hasOwnProperty(`${task.stack[idx]}_async`)) {
    updated_task = await taskFunctions[`${task.stack[idx]}_async`](task);
  } else {
    updated_task = task;
    const msg =
      "ERROR: nodejsProcessor unknown component at idx " + idx + " : " + task.stack;
    updated_task["error"] = msg;
    console.log(msg, taskFunctions);
  }
  await instancesStore_async.set(task.instanceId, updated_task);
  console.log("instancesStore_async set " + task.instanceId);
  //console.log(updated_task)
  return updated_task;
}

async function newTask_async(
  id,
  sessionId,
  threadId = null,
  siblingTask = null
) {
  let siblingInstanceId;
  if (siblingTask) {
    siblingInstanceId = siblingTask.instanceId;
    threadId = siblingTask.threadId;
  }
  if (!tasks[id]) {
    console.log("ERROR could not find task with id", id)
  }
  let taskCopy = { ...tasks[id] };
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
    if (parent?.stackPtr) {
      // Note component_depth may be modified in api/task/start
      taskCopy["stackPtr"] = parent.stackPtr;
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
  //console.log("New task ", taskCopy)
  console.log("New task id " + taskCopy.id);
  return taskCopy;
}

router.post("/update", async (req, res) => {
  console.log("/api/task/update");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    const sessionId = req.body.sessionId;
    let task = req.body.task;
    let address = req.body.address;

    if (task) {
      if (sessionId) {
        task.config["sessionId"] = sessionId;
      } else {
        console.log("Warning: sessionId missing");
      }
      if (address) {
        task.request["address"] = address;
      } // This should be done on the browserProcessor side
      if (task.updateCount) {
        task.updateCount += 1;
      } else {
        task["updateCount"] = 1;
      }
      if (task?.send) {
        task.send = false;
      }
    } else {
      const msg = "ERROR did not receive task";
      console.log(msg);
      res.status(404).json({ error: msg });
      return;
    }

    try {
      toTask(JSON.stringify(task)); // Validating
    } catch (error) {
      console.error("Error while validating Task against schema:", error, task);
    }

    // Risk that browserProcessor writes over nodejsProcessor fields so filter_out before merge
    let instanceId = task.instanceId;
    const server_side_task = await instancesStore_async.get(instanceId);
    // filter_in could also do some data cleaning
    //let clean_client_task = utils.filter_in(tasktemplates,tasks, task)
    let clean_client_task = task;
    let updated_task = utils.deepMerge(server_side_task, clean_client_task)
    //let updated_task = Object.assign({}, server_side_task, clean_client_task);

    //console.log("task ", task)
    //console.log("clean_client_task ", clean_client_task)
    //console.log("server_side_task ", server_side_task)
    //console.log("Merged task: ",updated_task)

    if (updated_task.state?.done) {
      console.log("Client side task done " + updated_task.id);
      updated_task.state.done = false;
      await instancesStore_async.set(instanceId, updated_task);
      updated_task = await newTask_async(
        updated_task.nextTask,
        sessionId,
        null,
        updated_task
      );
    } else {
      updated_task = await do_task_async(updated_task);
    }

    let i = 0;
    while (updated_task.config?.serverOnly || updated_task.error) {
      // A sanity check to avoid erroneuos infinite loops
      i = i + 1;
      if (i > 10) {
        console.log("Unexpected looping on server_only ", updated_task);
        exit;
      }
      if (updated_task.error) {
        let errorTask
        if (updated_task.config?.errorTask) {
          errorTask = updated_task.config.errorTask
        } else {
          // Assumes there is a default errorTask named error
          const strArr = updated_task.id.split('.');
          strArr[strArr.length - 1] = "error";
          errorTask = strArr.join('.');
        }
        updated_task.nextTask = errorTask
        updated_task.state.done = true
        console.log("Task error " + updated_task.id);
      } 
      if (updated_task.state.done) {
        console.log("Server side task done " + updated_task.id);
        updated_task.state.done = false;
        await instancesStore_async.set(updated_task.instanceId, updated_task);
        updated_task = await newTask_async(
          updated_task.nextTask,
          sessionId,
          null,
          updated_task
        );
      }
      if (updated_task.config?.serverOnly) {
        updated_task = await do_task_async(updated_task);
      } else {
        break;
      }
    }

    //console.log("Before filter: ", updated_task)
    //let updated_client_task = utils.filter_in(tasktemplates,tasks, updated_task)
    let updated_client_task = updated_task; // need to filter based on Schema
    //console.log("After filter: ", updated_client_task)

    let messageJsonString;
    let messageObject;
    try {
      const validatedTaskJsonString = fromTask(updated_client_task);
      let validatedTaskObject = JSON.parse(validatedTaskJsonString);
      messageObject = {
        task: validatedTaskObject,
      };
      messageJsonString = JSON.stringify(messageObject);
    } catch (error) {
      console.error("Error while validating Task against schema:", error, task);
      return;
    }
    //console.log(JSON.stringify(messageObject))
    res.send(messageJsonString);
  } else {
    res.status(200).json({ error: "No user" });
  }
});

router.post("/start", async (req, res) => {
  console.log("/api/task/start");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    const sessionId = req.body.sessionId;
    let task = req.body.task;
    let address = req.body.address;

    const startId = task.id;
    const threadId = task?.threadId;
    const component_depth = task.stackPtr;
    let groupId = task?.groupId;

    if (!tasks[startId]) {
      const msg = "ERROR could not find task " + startId;
      console.log(msg);
      res.status(404).json({ error: msg });
      return;
    } else {
      // default is to start a new thread
      // Instances key: no recorded in DB
      let task = await newTask_async(startId, sessionId, threadId);

      task["userId"] = userId;
      if (sessionId) {
        task.config["sessionId"] = sessionId;
      } else {
        console.log("Warning: sessionId missing");
      }
      if (address) {
        task.request["address"] = address;
      }
      // We start with the deepest component in the stack
      if (typeof component_depth === "number") {
        console.log("Setting component_depth", component_depth);
        task.stackPtr = component_depth;
      } else if (task?.stack) {
        task["stackPtr"] = task.stack.length;
      }

      //console.log(task)

      // Check if the user has permissions
      if (!utils.authenticatedTask(task, userId, groups)) {
        console.log("Task authentication failed", task.id, userId);
        res.status(400).json({ error: "Task authentication failed" });
        return;
      }

      if (task.config?.oneThread) {
        const threadId = startId + userId;
        let instanceIds = await threadsStore_async.get(threadId);
        if (instanceIds) {
          // Returning last so continuing (maybe should return first?)
          const instanceId = instanceIds[instanceIds.length - 1];
          task = await instancesStore_async.get(instanceId);
          console.log(
            "Restarting one_thread " + instanceId + " for " + task.id
          );
        } else {
          task.threadId = threadId
        }
      }
      if (task.config?.restoreSession) {
        const threadId = startId + sessionId;
        let instanceIds = await threadsStore_async.get(threadId);
        if (instanceIds) {
          // Returning last so continuing (maybe should return first?)
          const instanceId = instanceIds[instanceIds.length - 1];
          task = await instancesStore_async.get(instanceId);
          console.log("Restarting session " + instanceId + " for " + task.id);
        } else {
          task.threadId = threadId
        }
      }
      if (task.config?.collaborate) {
        // Taskflow to choose the group (taskflow should include that)
        if (!groupId) {
          // This is a hack for the collaborate feature
          groupId = task.config.collaborate;
        }
        const threadId = startId + groupId;
        let instanceIds = await threadsStore_async.get(threadId);
        if (instanceIds) {
          // Returning last so continuing (maybe should return first?)
          const instanceId = instanceIds[instanceIds.length - 1];
          task = await instancesStore_async.get(instanceId);
          console.log(
            "Restarting collaboration " + instanceId + " for " + task.id
          );
        } else {
          task.threadId = threadId
        }
      }

      await instancesStore_async.set(task.instanceId, task);

      //let updated_client_task = utils.filter_in(tasktemplates,tasks, task)
      let updated_client_task = task; // need to filter based on Schema

      let messageJsonString;
      let messageObject;
      try {
        const validatedTaskJsonString = fromTask(updated_client_task);
        let validatedTaskObject = JSON.parse(validatedTaskJsonString);
        messageObject = {
          task: validatedTaskObject,
        };
        messageJsonString = JSON.stringify(messageObject);
      } catch (error) {
        console.error(
          "Error while validating Task against schema:",
          error,
          task
        );
        return;
      }
      //console.log(JSON.stringify(messageObject))
      res.send(messageJsonString);
    }
  } else {
    res.status(200).json({ error: "No user" });
  }
});

export default router;
