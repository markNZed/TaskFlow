/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { v4 as uuidv4 } from "uuid";
import { utils } from "../src/utils.mjs";
import { groups, tasks } from "../src/configdata.mjs";
import { instancesStore_async, threadsStore_async } from "../src/storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { toTask, fromTask } from "../src/taskConverterWrapper.mjs";

const router = express.Router();

async function newTask_async(
  id,
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

router.post("/start", async (req, res) => {
  console.log("/hub/api/task/start");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    let sessionId = req.body?.sessionId;
    let task = req.body.task;
    let address = req.body?.address;
    const siblingTask = req.body?.siblingTask;

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
      task = await newTask_async(startId, threadId, siblingTask);

      if (!sessionId) {
        sessionId = siblingTask.config?.sessionId;
      }

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
    console.log("No user");
    res.status(200).json({ error: "No user" });
  }
});

export default router;
