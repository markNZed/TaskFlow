/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import newTask_async from "../newTask.mjs";
import { groups, tasks } from "../configdata.mjs";
import { instancesStore_async, threadsStore_async } from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { toTask, fromTask } from "../taskConverterWrapper.mjs";

const router = express.Router();

router.post("/start", async (req, res) => {
  console.log("/hub/api/task/start");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    let task = req.body.task;
    const siblingTask = req.body?.siblingTask;

    const ip = req.ip || req.connection.remoteAddress;
    //console.log('Source IP: ', ip);

    const startId = task.id;
    const threadId = task?.threadId;
    let sessionId = task?.sessionId;

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
      task = await newTask_async(startId, userId, threadId, siblingTask);
      task.source = ip;

      if (sessionId) {
        task.config["sessionId"] = sessionId;
      } else {
        console.log("Warning: sessionId missing");
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
