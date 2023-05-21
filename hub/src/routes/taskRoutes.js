/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import newTask_async from "../newTask.mjs";
import { activeTasksStore_async, } from "../storage.mjs";
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
    //const ip = req.ip || req.connection.remoteAddress;

    //console.log("task", task);

    const startId = task.id;
    const threadId = task.threadId;
    let sessionId = task.sessionId;
    const source = task.source;
    const processorId = task.newSource;

    const component_depth = task.stackPtr;

    // Maybe we just set initial task values and pass that in instead of a long list of arguments?
    const startTask = await newTask_async(startId, userId, true, source, sessionId, task?.groupId, component_depth, threadId, siblingTask);

    // Could convert this into aysynchronous form
    if (await activeTasksStore_async.has(startTask.instanceId)) {
      const activeTask = await activeTasksStore_async.get(startTask.instanceId)
      console.log("activeTask", activeTask)
      if (!activeTask.processorIds.includes(processorId)) {
        activeTask.processorIds.push(processorId);
        activeTasksStore_async.set(startTask.instanceId, activeTask);
      } 
    } else {
      const activeTask = {task: startTask, processorIds: [processorId]};
      activeTasksStore_async.set(startTask.instanceId, activeTask);
    }

    // Here we will need to send the task to each environment
    // We are not yet dealing with distributed tasks
    // In the case of a collaborative task this might require sending to a group
    // The newTask_async should build the list of processors

    let messageJsonString;
    let messageObject;
    try {
      const validatedTaskJsonString = fromTask(startTask);
      let validatedTaskObject = JSON.parse(validatedTaskJsonString);
      messageObject = {
        task: validatedTaskObject,
      };
      messageJsonString = JSON.stringify(messageObject);
    } catch (error) {
      console.error(
        "Error while validating Task against schema:",
        error,
        startTask
      );
      return;
    }
    //console.log(JSON.stringify(messageObject))
    res.send(messageJsonString);
  } else {
    console.log("No user");
    res.status(200).json({ error: "No user" });
  }
});

export default router;
