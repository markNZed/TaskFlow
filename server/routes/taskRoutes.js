/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from 'express';
import { v4 as uuidv4 } from 'uuid'
import { utils } from '../src/utils.mjs';
import { taskFunctions} from '../taskFunctions/taskFunctions.mjs';
import { groups, tasks, components } from './../src/configdata.mjs';
import { instancesStore_async, threadsStore_async} from './../src/storage.mjs'
import * as dotenv from 'dotenv'
dotenv.config()
import { toTask, fromTask } from '../src/taskConverterWrapper.mjs'
import { fromV01toV02, fromV02toV01 } from '../src/shared/taskV01toV02Map.mjs'

const router = express.Router();

async function do_task_async(task) {
    let updated_task = {}
    let idx = 0
    if (task.v02.meta?.stackPtr) {
      idx = task.v02.meta.stackPtr - 1
      console.log("Component ",task.v02.meta.stack, " idx ", idx)
    }
    if (taskFunctions.hasOwnProperty(`${task.v02.meta.stack[idx]}_async`)) {
      updated_task = await taskFunctions[`${task.v02.meta.stack[idx]}_async`](task);
    } else {
      updated_task = task;
      const msg = "ERROR: server unknown component at idx " + idx + " : " + task.v02.meta.stack;
      updated_task.v02.meta['error'] = msg;
      console.log(msg, taskFunctions);
    }
    await instancesStore_async.set(task.v02.meta.instanceId, updated_task)
    console.log("instancesStore_async set " + task.v02.meta.instanceId )
    //console.log(updated_task)
    return updated_task
}
  
async function newTask_async(id, sessionId, threadId = null, siblingTask = null) {
    let siblingInstanceId
    if (siblingTask) {
      siblingInstanceId = siblingTask.v02.meta.instanceId
      threadId = siblingTask.v02.meta.threadId
    }
    let taskCopy = { ...tasks[id] }
    taskCopy = fromV01toV02(taskCopy)
    let instanceId = uuidv4();
    taskCopy.v02.meta['instanceId'] = instanceId
    if (siblingInstanceId) {
      // Should reanme to sibling?
      taskCopy.v02.meta['parentInstanceId'] = siblingInstanceId
      let parent = await instancesStore_async.get(siblingInstanceId)
      if (parent.v02.request?.address) { taskCopy.v02.request['address'] = parent.v02.request.address }
      if (!threadId) {
        threadId = parent.v02.meta.threadId
      }
      if (parent.v02.meta?.stackPtr) {
        // Note component_depth may be modified in api/task/start
        taskCopy.v02.meta['stackPtr'] = parent.v02.meta.stackPtr
      }
      if (!parent.v02.meta.hasOwnProperty('childrenInstances') || !Array.isArray(parent.v02.meta.childrenInstances)) {
        parent.v02.meta.childrenInstances = [];
      }
      parent.v02.meta.childrenInstances.push(instanceId);
      await instancesStore_async.set(siblingInstanceId, parent)
    } else if (taskCopy.v02.meta?.stack) {
      // Note component_depth may be modified in api/task/start
      taskCopy.v02.meta['stackPtr'] =taskCopy.v02.meta.stack.length
    }
    if (threadId) {
      taskCopy.v02.meta['threadId'] = threadId
      let instanceIds = await threadsStore_async.get(threadId)
      if (instanceIds) {
        instanceIds.push(instanceId)
      } else {
        instanceIds = [instanceId]
      }
      await threadsStore_async.set(threadId, instanceIds)
    } else {
      taskCopy.v02.meta['threadId'] = instanceId
      await threadsStore_async.set(instanceId, [instanceId])
    }
    taskCopy.v02.meta['createdAt'] = Date.now()
    await instancesStore_async.set(instanceId, taskCopy)
    //console.log("New task ", taskCopy)
    console.log("New task id " + taskCopy.v02.meta.id)
    return taskCopy
}
  
router.post('/update', async (req, res) => {
    console.log("/api/task/update")
    let userId = utils.getUserId(req)
    if (userId) {
      console.log("req.body " + JSON.stringify(req.body))
      const sessionId = req.body.sessionId
      let task = req.body.task
      let address = req.body.address

      task = fromV01toV02(task) 

      if (task) {
        if (sessionId) { task.v02.config['sessionId'] = sessionId } else {console.log("Warning: sessionId missing")}
        if (address) { task.v02.request['address'] = address } // This should be done on the client side
        if (task.v02.meta.updateCount) {task.v02.meta.updateCount += 1} else {task.v02.meta['updateCount'] = 1}
        if (task.v02.meta?.send) {task.v02.meta.send = false}
      } else {
        const msg = "ERROR did not receive task"
        console.log(msg)
        res.status(404).json({ error: msg });
        return
      }

      try {
        toTask(JSON.stringify(task.v02)) // Validating
      } catch (error) {
        console.error("Error while validating Task against schema:", error, task);
      }
  
      // Risk that client writes over server fields so filter_out before merge
      let instanceId = task.v02.meta.instanceId
      const server_side_task = await instancesStore_async.get(instanceId)
      // filter_in could also do some data cleaning
      //let clean_client_task = utils.filter_in(components,tasks, task)
      let clean_client_task = task
      let updated_task = Object.assign({}, server_side_task, clean_client_task)
  
      //console.log("task ", task)
      //console.log("clean_client_task ", clean_client_task)
      //console.log("server_side_task ", server_side_task)
      //console.log("Merged task: ",updated_task)
  
      if (updated_task.v02.state?.done) {
        console.log("Client side task done " + updated_task.v02.meta.id)
        updated_task.v02.state.done = false
        await instancesStore_async.set(instanceId, updated_task)
        updated_task = await newTask_async(updated_task.v02.meta.nextTask, sessionId, null, updated_task)
      } else {
        updated_task = await do_task_async(updated_task)
      }
  
      let i = 0
      while (updated_task?.v02.config?.serverOnly) {
        // A sanity check to avoid erroneuos infinite loops
        i = i + 1
        if (i > 10) {
          console.log("Unexpected looping on server_only ", updated_task)
          exit
        }
        if (updated_task.v02.state.done) {
          console.log("Server side task done " + updated_task.v02.meta.id)
          //updated_task.done = false
          updated_task.v02.state.done = false
          await instancesStore_async.set(updated_task.v02.meta.instanceId, updated_task)
          updated_task = await newTask_async(updated_task.v02.meta.nextTask, sessionId, null, updated_task)
        }
        if (updated_task?.v02.config?.serverOnly) {
          updated_task = await do_task_async(updated_task)
        } else {
          break
        }
      }
  
      //console.log("Before filter: ", updated_task)
      //let updated_client_task = utils.filter_in(components,tasks, updated_task)
      let updated_client_task = updated_task // need to filter based on Schema
      //console.log("After filter: ", updated_client_task)

      let messageJsonString;
      try {
        const validatedTaskJsonString = fromTask(updated_client_task.v02);
        let validatedTaskObject = JSON.parse(validatedTaskJsonString);
        //validatedTaskObject = fromV02toV01({v02: validatedTaskObject})
        const messageObject = {
          task: validatedTaskObject,
        };
        messageJsonString = JSON.stringify(messageObject);
      } catch (error) {
        console.error("Error while validating Task against schema:", error, task);
        return;
      }
      console.log(messageJsonString)
      res.send(messageJsonString);
    } else {
      res.status(200).json({ error: "No user" });
    }
});
  
router.post('/start', async (req, res) => {
    console.log("/api/task/start")
    let userId = utils.getUserId(req)
    if (userId) {
      //console.log("req.body " + JSON.stringify(req.body))
      const sessionId = req.body.sessionId;
      let task = req.body.task
      let address = req.body.address;

      task = fromV01toV02(task) 

      const startId = task.v02.meta.id;
      const threadId = task.v02.meta?.threadId;
      const component_depth = task.v02.meta.stackPtr;
      let groupId = task.v02.meta?.groupId;
      
  
      if (!tasks[startId]) {
  
        const msg = "ERROR could not find task " + startId
        console.log(msg)
        res.status(404).json({ error: msg });
        return
  
      } else {      
  
        // default is to start a new thread
        // Instances key: no recorded in DB
        let task = await newTask_async(startId, sessionId, threadId)

        task.v02.meta['userId'] = userId
        if (sessionId) { task.v02.config['sessionId'] = sessionId }  else {console.log("Warning: sessionId missing")}
        if (address) { task.v02.request['address'] = address }
        // We start with the deepest component in the stack
        if (typeof component_depth === "number") {
          console.log("Setting component_depth", component_depth)
          task.v02.meta.stackPtr = component_depth
        } else if (task.v02.meta?.stack) {
          task.v02.meta['stackPtr'] = task.v02.meta.stack.length
        }
  
        //console.log(task)
  
        // Check if the user has permissions
        if (!utils.authenticatedTask(task, userId, groups)) {
          console.log("Task authentication failed", task.v02.meta.id, userId)
          res.status(400).json({ error: "Task authentication failed" });
          return
        }
  
        if (task.v02.config?.oneThread) {
          const threadId = startId + userId
          let instanceIds = await threadsStore_async.get(threadId)
          if (instanceIds) {
            // Returning last so continuing (maybe should return first?)
            const instanceId = instanceIds[instanceIds.length - 1]
            task = await instancesStore_async.get(instanceId)
            console.log("Restarting one_thread " + instanceId + " for " + task.id)
          }
        }
        if (task.v02.config?.restoreSession) {
          const threadId = startId + sessionId
          let instanceIds = await threadsStore_async.get(threadId)
          if (instanceIds) {
            // Returning last so continuing (maybe should return first?)
            const instanceId = instanceIds[instanceIds.length - 1]
            task = await instancesStore_async.get(instanceId)
            console.log("Restarting session " + instanceId + " for " + task.v02.meta.id)
          }
        }
        if (task.v02.config?.collaborate) {
          // Workflow to choose the group (workflow should include that)
          if (!groupId) {
            // This is a hack for the collaborate feature
            groupId = task.v02.config.collaborate
          }
          const threadId = startId + groupId
          let instanceIds = await threadsStore_async.get(threadId)
          if (instanceIds) {
            // Returning last so continuing (maybe should return first?)
            const instanceId = instanceIds[instanceIds.length - 1]
            task = await instancesStore_async.get(instanceId)
            console.log("Restarting collaboration " + instanceId + " for " + task.v02.meta.id)
          }
        }
  
        await instancesStore_async.set(task.v02.meta.instanceId, task)
    
        //let updated_client_task = utils.filter_in(components,tasks, task)
        let updated_client_task = task // need to filter based on Schema

        let messageJsonString;
        try {
          const validatedTaskJsonString = fromTask(updated_client_task.v02)
          let validatedTaskObject = JSON.parse(validatedTaskJsonString)
          //validatedTaskObject = fromV02toV01({v02: validatedTaskObject})
          const messageObject = {
            task: validatedTaskObject,
          };
          messageJsonString = JSON.stringify(messageObject);
        } catch (error) {
          console.error("Error while validating Task against schema:", error, task.v02)
          return;
        }
        //console.log(JSON.stringify(messageObject))
        res.send(messageJsonString);
      }
    } else {
      res.status(200).json({ error: "No user" });
    }
});

export default router;