/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from 'express';
import { v4 as uuidv4 } from 'uuid'
import { utils } from '../src/utils.mjs';
import { taskFunctions} from '../taskFunctions/taskFunctions.mjs';
import { groups, tasks } from './../src/configdata.mjs';
import { instancesStore_async, threadsStore_async} from './../src/storage.mjs'
import { DEFAULT_USER } from './../config.mjs';
import * as dotenv from 'dotenv'
dotenv.config()

const router = express.Router();

async function do_task_async(task) {
    let updated_task = {}
    let idx = 0
    if (task?.component_depth) {
      idx = task.component_depth - 1
      console.log("Component ",task.component, " idx ", idx)
    }
    if (taskFunctions.hasOwnProperty(`${task.component[idx]}_async`)) {
      updated_task = await taskFunctions[`${task.component[idx]}_async`](task);
    } else {
      updated_task = task;
      const msg = "ERROR: server unknown component at idx " + idx + " : " + task.component;
      updated_task.error = msg;
      console.log(msg, taskFunctions);
    }
    await instancesStore_async.set(task.instanceId, updated_task)
    console.log("instancesStore_async set " + task.instanceId )
    //console.log(updated_task)
    return updated_task
}
  
async function newTask_async(id, sessionId, threadId = null, siblingTask = null) {
    let siblingInstanceId
    if (siblingTask) {
      siblingInstanceId = siblingTask.instanceId
      threadId = siblingTask.threadId
    }
    let taskCopy = { ...tasks[id] };
    taskCopy['sessionId'] = sessionId
    let instanceId = uuidv4();
    taskCopy['instanceId'] = instanceId
    if (siblingInstanceId) {
      // Should reanme to sibling?
      taskCopy['parentInstanceId'] = siblingInstanceId
      let parent = await instancesStore_async.get(siblingInstanceId)
      if (parent?.address) { taskCopy['address'] = parent.address }
      if (!threadId) {
        threadId = parent.threadId
      }
      if (parent?.component_depth) {
        // Note component_depth may be modified in api/task/start
        taskCopy['component_depth'] = parent.component_depth
      }
      parent.childInstance = instanceId
      await instancesStore_async.set(siblingInstanceId, parent)
    } else if (taskCopy?.component) {
      // Note component_depth may be modified in api/task/start
      taskCopy['component_depth'] = taskCopy.component.length
    }
    if (threadId) {
      taskCopy['threadId'] = threadId
      let instanceIds = await threadsStore_async.get(threadId)
      if (instanceIds) {
        instanceIds.push(instanceId)
      } else {
        instanceIds = [instanceId]
      }
      await threadsStore_async.set(threadId, instanceIds)
    } else {
      taskCopy['threadId'] = instanceId
      await threadsStore_async.set(instanceId, [instanceId])
    }
    const now = new Date();
    taskCopy['created'] = now
    await instancesStore_async.set(instanceId, taskCopy)
    //console.log("New task ", taskCopy)
    console.log("New task id " + taskCopy.id)
    return taskCopy
}
  
router.post('/update', async (req, res) => {
    console.log("/api/task/update")
    let userId = utils.getUserId(req)
    if (userId) {
      //console.log("req.body " + JSON.stringify(req.body))
      const sessionId = req.body.sessionId
      let task = req.body.task
      let address = req.body.address

      if (task) {
        if (sessionId) { task['sessionId'] = sessionId } else {console.log("Warning: sessionId missing")}
        if (address) { task['address'] = address }
        if (task?.update_count) {task.update_count += 1} else {task['update_count'] = 1}
      } else {
        const msg = "ERROR did not receive task"
        console.log(msg)
        res.status(404).json({ error: msg });
        return
      }
  
      // Risk that client writes over server fields so filter_out before merge
      let instanceId = task.instanceId
      const server_side_task = await instancesStore_async.get(instanceId)
      // filter_out could also do some data cleaning
      let clean_client_task = utils.filter_in(tasks, task)
      let updated_task = Object.assign({}, server_side_task, clean_client_task)
  
      //console.log("task ", task)
      //console.log("clean_client_task ", clean_client_task)
      //console.log("server_side_task ", server_side_task)
      //console.log("Merged task: ",updated_task)

  
      if (updated_task?.done) {
        console.log("Client side task done " + updated_task.id)
        updated_task.done = false
        await instancesStore_async.set(instanceId, updated_task)
        updated_task = await newTask_async(updated_task.next, sessionId, null, updated_task)
      } else {
        updated_task = await do_task_async(updated_task)
      }
  
      let i = 0
      while (updated_task?.server_only) {
        // A sanity check to avoid erroneuos infinite loops
        i = i + 1
        if (i > 10) {
          console.log("Unexpected looping on server_only ", updated_task)
          exit
        }
        if (updated_task?.done) {
          console.log("Server side task done " + updated_task.id)
          updated_task.done = false
          await instancesStore_async.set(updated_task.instanceId, updated_task)
          updated_task = await newTask_async(updated_task.next, sessionId, null, updated_task)
        }
        if (updated_task?.server_only) {
          updated_task = await do_task_async(updated_task)
        } else {
          break
        }
      }
  
      let updated_client_task = utils.filter_in(tasks, updated_task)
      res.send(JSON.stringify(updated_client_task));
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
      const startId = req.body.startId;
      const threadId = req.body?.threadId;
      const component_depth = req.body?.component_depth;
      let groupId = req.body.groupId;
      let address = req.body.address;
  
      if (!tasks[startId]) {
  
        const msg = "ERROR could not find task " + startId
        console.log(msg)
        res.status(404).json({ error: msg });
        return
  
      } else {      
  
        // default is to start a new thread
        // Instances key: no recorded in DB
        let task = await newTask_async(startId, sessionId, threadId)
        task['userId'] = userId
        if (sessionId) { task['sessionId'] = sessionId }  else {console.log("Warning: sessionId missing")}
        if (address) { task['address'] = address }
        // We start with the deepest component in the stack
        if (typeof component_depth === "number") {
          console.log("Setting component_depth", component_depth)
          task.component_depth = component_depth
        } else if (task?.component) {
          task.component_depth = task?.component.length
        }
  
        //console.log(task)
  
        // Check if the user has permissions
        if (!utils.authenticatedTask(task, userId, groups)) {
          console.log("Task authentication failed", task.id, userId)
          res.status(400).json({ error: "Task authentication failed" });
          return
        }
  
        if (task?.one_thread) {
          const threadId = startId + userId
          let instanceIds = await threadsStore_async.get(threadId)
          if (instanceIds) {
            // Returning last so continuing (maybe should return first?)
            const instanceId = instanceIds[instanceIds.length - 1]
            task = await instancesStore_async.get(instanceId)
            console.log("Restarting one_thread " + instanceId + " for " + task.id)
          }
        }
        if (task?.restore_session) {
          const threadId = startId + sessionId
          let instanceIds = await threadsStore_async.get(threadId)
          if (instanceIds) {
            // Returning last so continuing (maybe should return first?)
            const instanceId = instanceIds[instanceIds.length - 1]
            task = await instancesStore_async.get(instanceId)
            console.log("Restarting session " + instanceId + " for " + task.id)
          }
        }
        if (task?.collaborate) {
          // Workflow to choose the group (workflow should include that)
          if (!groupId) {
            // This is a hack for the collaborate feature
            groupId = task.collaborate
          }
          const threadId = startId + groupId
          let instanceIds = await threadsStore_async.get(threadId)
          if (instanceIds) {
            // Returning last so continuing (maybe should return first?)
            const instanceId = instanceIds[instanceIds.length - 1]
            task = await instancesStore_async.get(instanceId)
            console.log("Restarting collaboration " + instanceId + " for " + task.id)
          }
        }
  
        await instancesStore_async.set(task.instanceId, task)
    
        let updated_client_task = utils.filter_in(tasks, task)
        res.send(JSON.stringify(updated_client_task));
      }
    } else {
      res.status(200).json({ error: "No user" });
    }
});

export default router;