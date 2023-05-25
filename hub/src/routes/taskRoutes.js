/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import newTask_async from "../newTask.mjs";
import { activeTasksStore_async} from "../storage.mjs";
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
    const source = task.source;
    const processorId = task.newSource;

    const component_depth = task.stackPtr;

    // Just set initial task values and pass that in instead of a long list of arguments?
    await newTask_async(startId, userId, true, source, processorId, sessionId, task?.groupId, component_depth, threadId, siblingTask);
    res.json({task: "synchronizing"});
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
    //console.log("req.body " + JSON.stringify(req.body))
    let task = req.body.task;
    // We intercept tasks that are done.
    if (task.state?.done) {
      doneTask_async(task) 
      res.json({task: "synchronizing"});
      return;
    // Pass on tasks that are not done
    // Eventually this will go as we will not send tasks but rely on data synchronization across clients
    } else{
      // Just a hack for now
      console.log("task " + task.id + " from " + task.newSource)
      const activeTask = await activeTasksStore_async.get(task.instanceId)
      if (activeTask) {
        activeTask.task = task;
        await activeTasksStore_async.set(task.instanceId, activeTask);
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
