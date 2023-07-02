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
import { doneTask_async } from "../doneTask.mjs";

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("/hub/api/task");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    let task = req.body.task;
    // We are not using this yet, could have a single API endpoint
    if (!task.processor) {
      throw new Error("Missing task.processor in /hub/api/task");
    }
    const command = task.processor.command;
    task.processor.command = null;
    let commandArgs = {};
    if (task.processor?.commandArgs) {
      commandArgs = JSON.parse(JSON.stringify(task.processor.commandArgs));
      task.processor.commandArgs = null;
    }
    const processorId = task.processor.id;
    task.processor[processorId] = JSON.parse(JSON.stringify(task.processor));
    task.hub = {};
    task.hub["command"] = command;
    task.hub["commandArgs"] = commandArgs;
    task.hub["sourceProcessorId"] = processorId;
    let lock = commandArgs.lock || false;
    let unlock = commandArgs.unlock || false;
    let lockBypass = commandArgs.lockBypass || false;
    // Check if the task is locked
    const activeTask = await activeTasksStore_async.get(task.instanceId);
    if (activeTask) {
      // Restore the other processors
      const processor = activeTask.processor;
      processor[processorId] = JSON.parse(JSON.stringify(task.processor));
      task.processor = processor;
    }
    if (unlock) {
      task.meta["locked"] = null;
      console.log("Task forced unlock by " + processorId);
    }
    if (lock) {
      if (activeTask && !activeTask.meta.locked) {
        console.log("Task locked by " + processorId);
        task.meta["locked"] = processorId;
      }
    } else if (activeTask && activeTask.meta.locked && activeTask.meta.locked === processorId) {
      console.log("Task unlocked by " + processorId);
      task.meta.locked = null;
    }
    if (
      activeTask && 
      activeTask.meta.locked && 
      activeTask.meta.locked !== processorId && 
      !lockBypass &&!unlock
    ) {
      let now = new Date(); // Current time
      let updatedAt;
      if (task.meta.updatedAt) {
        updatedAt = new Date(task.meta.updatedAt.date); 
      }
      // Get the difference in minutes
      let differenceInMinutes = (now - updatedAt) / 1000 / 60;
      console.log("differenceInMinutes", differenceInMinutes)
      if (differenceInMinutes > 5 || updatedAt === undefined) {
        console.log("Task lock expired for " + processorId + " locked by " + activeTask.meta.locked)
      } else {
        console.log("Task lock conflict with " + processorId + " locked by " + activeTask.meta.locked + " " + differenceInMinutes + " minutes ago.")
        return res.status(423).send("Task locked");
      } 
    }
    // Control API rate
    const currentDate = new Date(); // Will be local time
    const resetDate = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), currentDate.getUTCHours(), currentDate.getUTCMinutes());
    // If task has been updated before
    const maxRequestRate = task?.config?.maxRequestRate; // per minute
    if (maxRequestRate && task.meta.updatedAt) {
      const updatedAt = new Date(task.meta.updatedAt.date);
      // If the last update happened within the current minute
      if (updatedAt >= resetDate) {
        // If updates this minute is more than the max rate, cannot update
        if (task.meta.requestsThisMinute >= maxRequestRate) {
          return res.status(409).json({ error: "Task update rate exceeded " + maxRequestRate + " per minute"});
        }
      } else {
        // If the last update was not in the current minute, reset the counter
        //console.log("task.meta.requestsThisMinute = 0")
        task.meta.requestsThisMinute = 0;
      }
      task.meta.requestsThisMinute++;
    }
    const maxRequestCount = task?.config?.maxRequestCount;
    if (maxRequestCount && task.meta.maxRequestCount > maxRequestCount) {
      return res.status(409).json({ error: "Task request count exceeded" });
    }
    // Catch errors
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
      // Should be using command here?
      task.hub["command"] = "error";
      task.hub["commandArgs"] = {"errorTask": errorTask, "done": true};
      console.log("Task error " + task.id);
    }
    if (task.output) {
      let output = await outputStore_async.get(task.familyId);
      if (!output) {
        output = {};
      }
      output[task.id] = task.output;
      await outputStore_async.set(task.familyId, output);
    }
    // Switch to function based on task.hub["command"]
    switch (task.hub["command"]) {
      case "start":
        return await start_async(res, processorId, commandArgs, task)
      case "update":
        return await update_async(res, processorId, commandArgs, task)
      default:
        throw new Error("Unknown command " + task.hub["command"]);
    }
  } else {
    console.log("No user");
    res.status(500).json({ error: "No user" });
  }
});

async function start_async(res, processorId, commandArgs, task) {
  //console.log("start_async task", task);
  try {
    console.log("start_async " + commandArgs.id + " by " + task.id);
    const initTask = {
      id: commandArgs.id,
      userId: task.userId,
    }
    let prevInstanceId;
    if (commandArgs.prevInstanceId) {
      prevInstanceId = commandArgs.prevInstanceId;
    } else {
      prevInstanceId = task.instanceId;
    }
    // Just set initial task values and pass that in instead of a long list of arguments?
    await startTask_async(initTask, true, processorId, prevInstanceId);
    res.status(200).send("ok");
  } catch (err) {
    throw err;
    console.log("Error starting task " + task.id + " " + err);
    res.status(500).json({ error: "Error starting task " + task.id + " " + err });
  }
}

async function update_async(res, processorId, commandArgs, task) {
  console.log("update_async " + task.id);
  // We intercept tasks that are done.
  if (commandArgs?.done) {
    doneTask_async(task) 
    return res.status(200).send("ok");
  // Pass on tasks that are not done
  } else {
    console.log("Update task " + task.id + " in state " + task.state?.current + " from " + processorId)
    task.meta.updateCount = task.meta.updateCount + 1;
    // Don't await so the return gets back before the websocket update
    // Middleware will send the update
    activeTasksStore_async.set(task.instanceId, task);
    // So we do not return a task anymore. This requires the task synchronization working.
    res.status(200).send("ok");
  }
}

export default router;


