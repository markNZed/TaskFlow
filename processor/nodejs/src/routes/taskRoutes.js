/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import { taskFunctions } from "../../Task/taskFunctions.mjs";
import { instancesStore_async, activeTasksStore_async } from "../storage.mjs";
import { startTask_async } from "../startTask.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { toTask, fromTask } from "../taskConverterWrapper.mjs";

const router = express.Router();
const activeTasks = {};

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
      "ERROR: NodeJS Task Processor unknown component at idx " + idx + " : " + task.stack;
    updated_task["error"] = msg;
    console.log(msg, taskFunctions);
  }
  await instancesStore_async.set(task.instanceId, updated_task);
  console.log("instancesStore_async set " + task.instanceId);
  //console.log(updated_task)
  return updated_task;
}

async function activateTask_async(instanceId, task) {
  await activeTasksStore_async.set(instanceId, task)
  // We use a hash to avoid duplicates
  activeTasks[instanceId] = true;
  processActiveTasks_async(instanceId)
}

async function processActiveTasks_async() {
 return
}

router.post("/update", async (req, res) => {
  console.log("/api/task/update");
  let userId = utils.getUserId(req);
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    let task = req.body.task;

    if (task) {
      if (!task.sessionId) {
        console.log("Warning: sessionId missing from task");
      }
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

    // Risk that React Task Processor writes over NodeJS Task Processor fields so filter_out before merge
    let instanceId = task.instanceId;
    const server_side_task = await instancesStore_async.get(instanceId);
    let clean_client_task = task;
    let updated_task = utils.deepMerge(server_side_task, clean_client_task)
    //let updated_task = Object.assign({}, server_side_task, clean_client_task);

    // process the task
    activateTask_async(instanceId, updated_task);

    //console.log("task ", task)
    //console.log("clean_client_task ", clean_client_task)
    //console.log("server_side_task ", server_side_task)
    //console.log("Merged task: ",updated_task)

    // This should be done on the Hub
    if (updated_task.state.done) {
      console.error("Unexpected task done " + updated_task.id);
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
        // Fetch from the Task Hub
        updated_task = await startTask_async(userId, updated_task.nextTask, updated_task);
      }
      if (updated_task.config?.serverOnly) {
        updated_task = await do_task_async(updated_task);
      } else {
        break;
      }
    }

    let messageJsonString;
    let messageObject;
    try {
      const validatedTaskJsonString = fromTask(updated_task);
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
    console.log("No user");
    res.status(200).json({ error: "No user" });
  }
});

export default router;
