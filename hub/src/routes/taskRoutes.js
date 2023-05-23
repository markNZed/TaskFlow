/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import newTask_async from "../newTask.mjs";
import { activeTasksStore_async, instancesStore_async} from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { toTask, fromTask } from "../taskConverterWrapper.mjs";
import updateTask_async from "../updateTask.mjs";
import { NODEJS_URL} from "../../config.mjs";
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

    // Maybe we just set initial task values and pass that in instead of a long list of arguments?
    const startTask = await newTask_async(startId, userId, true, source, processorId, sessionId, task?.groupId, component_depth, threadId, siblingTask);

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

router.post("/update", async (req, res) => {
  console.log("/hub/api/task/update");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    let task = req.body.task;
    // We intercept tasks that are done.
    if (task.state?.done) {
      task = await doneTask_async(task) 
      res.json({task: newTask});
      return;
    // Pass on tasks that are not done
    // Eventually this will go as we will not send tasks but rely on data synchronization across clients
    } else{
      // Just a hack for now
      task.destination = NODEJS_URL + "/api/task/update";
      task = await updateTask_async(task)
      let activeTask = await activeTasksStore_async.get(task.instanceId);
      //console.log("activeTask",task.instanceId, activeTask);
      activeTask.task = task
      activeTasksStore_async.set(task.instanceId, activeTask);
      // Somehow we need to indicate that the task has changed.
      res.json({task: task});
    }
  } else {
    console.log("No user");
    // Clean up all the HTTP IDs used on routes
    res.status(200).json({ error: "No user" });
  }
});

export default router;