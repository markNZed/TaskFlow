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
import { processors, tasktemplates } from "../configdata.mjs";
import { NODEJS_URL} from "../../config.mjs";

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
      console.log("Task done through proxy " + task.id);
      task.state.done = false;
      instancesStore_async.set(task.instanceId, task);
      // We should send a delete message to all the copies and also delete those (see Meteor protocol)
      activeTasksStore_async.delete(task.instanceId);
      // Fetch from the Task Hub
      let newTask = await newTask_async(task.nextTask, userId, false, task.source, task.newSource, task.sessionId, task?.groupId, task.stackPtr, task.nextTask, task);
      // What is the active tasktemplate?
      const tasktemplateName = newTask.stack[newTask.stackPtr - 1]
      //console.log("tasktemplateName", tasktemplateName);
      const tasktemplate = tasktemplates["root." + tasktemplateName]
      //console.log("tasktemplate", tasktemplate);
      const environments = tasktemplate.environments;
      // Need to deal with multiple environments.
      // If the task.source is not in the environments array then we need to send the task to the relevant processor.
      //console.log("environments", environments);
      //console.log("task.source", task.source);
      if (environments.indexOf(task.source) !== -1) {
        // The source is in the environments array so we can just return.
        console.log("Remember to deal with multiple environments")
        res.json({task: newTask});
        return;
      } else if (environments.length === 1) {
        // The desired environment
        const environment = environments[0];
        // Assuming there is one processor for each environment
        const processor = processors["root." + environment];
        //console.log("processor", processor);
        // send the task to the correct processor
        if (environment === "nodejs") {
          newTask.destination = processor.url + "/api/task/update";
          //console.log("newTask", newTask)
          // This update activity basically creates the task on the processor
          newTask = await updateTask_async(newTask)
          res.json({task: newTask});
          return;
        } else {
          console.log("Need to deal with other environments than nodejs " + environment);
        }
      } else {
        console.log("Need to deal with multiple environments")
      }
      throw new Error("Should not be here");
    // Pass on tasks that are not done
    // Eventually this will go as we will not send tasks but rely on data synchronization across clients
    } else{
      // Just a hack for now
      task.destination = NODEJS_URL + "/api/task/update";
      task = await updateTask_async(task)
      res.json({task: task});
    }
  } else {
    console.log("No user");
    // Clean up all the HTTP IDs used on routes
    res.status(200).json({ error: "No user" });
  }
});

export default router;
