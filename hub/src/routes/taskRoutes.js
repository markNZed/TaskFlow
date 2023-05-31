/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import newTask_async from "../newTask.mjs";
import { activeTasksStore_async } from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { toTask, fromTask } from "../taskConverterWrapper.mjs";
import { doneTask_async } from "../doneTask.mjs";

const router = express.Router();

router.post("/start", async (req, res) => {
  console.log("/hub/api/task/start");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    let task = req.body.task;
    const siblingTask = req.body?.siblingTask;
    //const ip = req.ip || req.connection.remoteAddress;

    //console.log("task", task);

    const startId = task.id;
    const threadId = task.threadId;
    const sessionId = task.sessionId;
    const processorId = task.source;

    const stackPtr = task.stackPtr;

    try {
      // Just set initial task values and pass that in instead of a long list of arguments?
      await newTask_async(startId, userId, true, processorId, sessionId, task?.groupId, stackPtr, threadId, siblingTask);
      res.json({task: "synchronizing"});
    } catch (err) {
      console.log("Error starting task " + startId + " " + err);
      res.status(200).json({ error: "Error starting task " + startId + " " + err });
    }
    return;

  } else {
    console.log("No user");
    res.status(200).json({ error: "No user" });
  }
});

router.post("/update", async (req, res) => {
  console.log("/hub/api/task/update");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body", req.body.task.output.msgs)
    let task = req.body.task;
    task["send"] = false;
    // We intercept tasks that are done.
    if (task.error) {
      let errorTask
      if (task.config?.errorTask) {
        errorTask = task.config.errorTask
      } else {
        // Assumes there is a default errorTask named error
        const strArr = task.id.split('.');
        strArr[strArr.length - 1] = "error";
        errorTask = strArr.join('.');
      }
      task.nextTask = errorTask
      task.state.done = true
      console.log("Task error " + task.id);
    }
    if (task.state?.done) {
      doneTask_async(task) 
      res.json({task: "synchronizing"});
      return;
    // Pass on tasks that are not done
    // Eventually this will go as we will not send tasks but rely on data synchronization across clients
    } else{
      console.log("Update task " + task.id + " in state " + task.state?.current + " from " + task.source)
      const activeTask = await activeTasksStore_async.get(task.instanceId)
      if (activeTask) {
        await activeTasksStore_async.set(task.instanceId, task);
        // So we do not return a task anymore. This requires the task synchronization working.
        res.json({task: "synchronizing"});
        return;
      } else {
        console.log("No active task for " + task.instanceId);
        res.json({task: "synchronizing error"});
        return;
      }
    }
  } else {
    console.log("No user");
    // Clean up all the HTTP IDs used on routes
    res.status(200).json({ error: "No user" });
  }
});

export default router;
