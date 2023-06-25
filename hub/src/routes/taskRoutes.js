/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import startTask_async from "../startTask.mjs";
import { activeTasksStore_async, outputStore_async } from "../storage.mjs";
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
    // We are not using this yet, could have a single API endpoint
    if (!task.processor) {
      throw new Error("Missing task.processor in /hub/api/task/start");
    }
    const command = task.processor.command;
    const commandArgs = task.processor?.commandArgs;
    const processorId = task.processor.id;
    delete task.processor.command;
    delete task.processor.commandArgs;
    task.processor[processorId] = JSON.parse(JSON.stringify(task.processor));
    const siblingTask = req.body?.siblingTask;
    //const ip = req.ip || req.connection.remoteAddress;
    //console.log("task", task);
    const startId = task.id;
    const familyId = task.familyId;
    const stackPtr = task.stackPtr;
    try {
      // Just set initial task values and pass that in instead of a long list of arguments?
      await startTask_async(startId, userId, true, processorId, task?.groupId, stackPtr, familyId, siblingTask);
      return res.status(200).send("ok");
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
    //console.log("req.body.task.processor", req.body.task.processor)
    let task = req.body.task;
    // We are not using this yet, could have a single API endpoint
    // We are not using this yet, could have a single API endpoint
    if (!task.processor) {
      throw new Error("Missing task.processor in /hub/api/task/start");
    }
    const command = task.processor.command;
    const commandArgs = task.processor?.commandArgs;
    const processorId = task.processor.id;
    delete task.processor.command;
    delete task.processor.commandArgs;
    // Check if the task is locked
    const activeTask = await activeTasksStore_async.get(task.instanceId);
    if (!activeTask) {
      return res.status(404).send("Task not found");
    }
    if (task.lock) {
      if (!activeTask.locked) {
        console.log("Task locked by " + processorId);
        task.locked = processorId;
      }
      task.lock = false;
    } else if (activeTask.locked && activeTask.locked === processorId) {
      console.log("Task unlocked by " + processorId);
      task.locked = false;
    }
    if (task.unlock) {
      task.locked = false;
      task.locked = false;
    }
    if (activeTask.locked && activeTask.locked !== processorId && !task.lockBypass) {
      let now = new Date(); // Current time
      let updatedAt;
      if (task.meta.updatedAt) {
        updatedAt = new Date(task.meta.updatedAt.date); 
      }
      // Get the difference in minutes
      let differenceInMinutes = (now - updatedAt) / 1000 / 60;
      console.log("differenceInMinutes", differenceInMinutes)
      if (differenceInMinutes > 5 || updatedAt === undefined) {
        console.log("Task lock expired for " + processorId + " locked by " + activeTask.locked)
        task.locked = false;
      } else {
        console.log("Task lock conflict with " + processorId + " locked by " + activeTask.locked + " " + differenceInMinutes + " minutes ago.")
        return res.status(423).send("Task locked");
      } 
    }
    task.lockBypass ? task.lockBypass = false : undefined;
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
      task.done = true
      console.log("Task error " + task.id);
    }
    if (task.config?.maxUpdateCount && task?.meta?.updateCount > task.config.maxUpdateCount) {
      return res.status(409).json({ error: "Task update count exceeded" });
    }
    const currentDate = new Date(); // Will be local time
    const resetDate = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), currentDate.getUTCHours(), currentDate.getUTCMinutes());
    // If task has been updated before
    const maxUpdateRate = 30; // per minute
    if (task.meta.updatedAt) {
      const updatedAt = new Date(task.meta.updatedAt.date);
      // If the last update happened within the current minute
      if (updatedAt >= resetDate) {
        // If updates this minute is more than the max rate, cannot update
        if (task.meta.updatesThisMinute >= maxUpdateRate) {
          return res.status(409).json({ error: "Task update rate exceeded " + maxUpdateRate + " per minute"});
        }
      } else {
        // If the last update was not in the current minute, reset the counter
        //console.log("task.meta.updatesThisMinute = 0")
        task.meta.updatesThisMinute = 0;
      }
    }
    //console.log("task.meta.updatesThisMinute", task.meta.updatesThisMinute)
    task.meta.updatesThisMinute++;
    let output = await outputStore_async.get(task.familyId);
    if (!output) {
      output = {};
    }
    output[task.id] = task.output;
    await outputStore_async.set(task.familyId, output);
    // Restore the other processors
    const processor = activeTask.processor;
    processor[processorId] = JSON.parse(JSON.stringify(task.processor));
    task.processor = processor;
    task.hub = activeTask.hub;
    task.hub["command"] = "update";
    task.hub["sourceProcessorId"] = processorId; 
    if (task.done || task.next) {
      doneTask_async(task) 
      return res.status(200).send("ok");
    // Pass on tasks that are not done
    // Eventually this will go as we will not send tasks but rely on data synchronization across clients
    } else {
      console.log("Update task " + task.id + " in state " + task.state?.current + " from " + processorId)
      task.meta.updateCount = task.meta.updateCount + 1;
      // Don't await so the return gets back before the websocket update
      //task.processor[processorId].command = "update";
      // Middleware will send the update
      activeTasksStore_async.set(task.instanceId, task);
      // So we do not return a task anymore. This requires the task synchronization working.
      return res.status(200).send("ok");
    }
  } else {
    console.log("No user");
    // Clean up all the HTTP IDs used on routes
    res.status(200).json({ error: "No user" });
  }
});

router.post("/next", async (req, res) => {
  console.log("/hub/api/task/next");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body.task.processor", req.body.task.processor)
    let task = req.body.task;
    // We are not using this yet, could have a single API endpoint
    // We are not using this yet, could have a single API endpoint
    if (!task?.processor?.id) {
      throw new Error("Missing task.processor.id in /hub/api/task/next " + JSON.stringify(task));
    }
    const command = task.processor?.command;
    const commandArgs = task.processor?.commandArgs;
    const processorId = task.processor.id;
    delete task.processor.command;
    delete task.processor.commandArgs;
    const activeTask = await activeTasksStore_async.get(task.instanceId);
    // Restore the other processors
    const processor = activeTask.processor;
    task.processor = processor;
    processor[processorId] = JSON.parse(JSON.stringify(task.processor));
    task.hub = activeTask.hub;
    task.hub["command"] = "next";
    task.hub["sourceProcessorId"] = processorId; 
    if (!activeTask) {
      return res.status(404).send("Task not found");
    }
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
      task.done = true
      console.log("Task error " + task.id);
    }
    let output = await outputStore_async.get(task.familyId);
    if (!output) {
      output = {};
    }
    output[task.id] = task.output;
    await outputStore_async.set(task.familyId, output);
    task.next = true; // We probably don't need this but doneTask_async is using it
    doneTask_async(task) 
    return res.status(200).send("ok");
  } else {
    console.log("No user");
    // Clean up all the HTTP IDs used on routes
    res.status(200).json({ error: "No user" });
  }
});

export default router;
