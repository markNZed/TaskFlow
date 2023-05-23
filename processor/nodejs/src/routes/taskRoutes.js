/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import { instancesStore_async } from "../storage.mjs";
import { updateTask_async } from "../updateTask.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import { toTask, fromTask } from "../taskConverterWrapper.mjs";
import { do_task_async } from "../doTask.mjs";

const router = express.Router();

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
 
    //console.log("task ", task)
    //console.log("clean_client_task ", clean_client_task)
    //console.log("server_side_task ", server_side_task)
    //console.log("Merged task: ",updated_task)

    // This should be done on the Hub
    if (updated_task.state.done) {
      throw new Error("Unexpected task done " + updated_task.id);
    }

    updated_task = await do_task_async(updated_task);

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
