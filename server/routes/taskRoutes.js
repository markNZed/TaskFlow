/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from 'express';
import { v4 as uuidv4 } from 'uuid'
import { utils } from '../src/utils.mjs';
import { tasksFn } from '../tasksFn/tasksFn.mjs';
import { chat_async } from '../src/chat.mjs';
import { groups, tasks } from './../src/configdata.mjs';
import { instancesStore_async, threadsStore_async} from './../src/storage.mjs'
import { DEFAULT_USER } from './../config.mjs';
import * as dotenv from 'dotenv'
dotenv.config()

const router = express.Router();

// Globals:
// instancesStore_async
// tasks
// threadsStore_async

async function do_task_async(task) {
    let updated_task = {}
    switch (task.component) {
        case 'TaskFromAgent':
        updated_task = await tasksFn.TaskFromAgent_async(threadsStore_async, instancesStore_async, chat_async, task)
        break;
        case 'TaskShowResponse':
        updated_task = await tasksFn.TaskShowResponse_async(threadsStore_async, instancesStore_async, chat_async, task)
        break;         
        case 'TaskChoose':
        updated_task = await tasksFn.TaskChoose_async(threadsStore_async, instancesStore_async, chat_async, task)
        break;         
        case 'TaskChat':
        updated_task = await tasksFn.TaskChat_async(threadsStore_async, instancesStore_async, chat_async, task)
        break;         
        default:
        updated_task = task
        const msg = "ERROR: server unknown component:" + task.component
        updated_task.error = msg
        console.log(msg)
    }
    await instancesStore_async.set(task.instanceId, updated_task)
    console.log("instancesStore_async set " + task.instanceId )
    //console.log(updated_task)
    return updated_task
}
  
async function newTask_async(id, sessionId, threadId = null, parentTask = null) {
    let parentInstanceId
    if (parentTask) {
      parentInstanceId = parentTask.instanceId
      threadId = parentTask.threadId
    }
    let taskCopy = { ...tasks[id] };
    taskCopy['sessionId'] = sessionId
    let instanceId = uuidv4();
    taskCopy['instanceId'] = instanceId
    if (parentInstanceId) {
      taskCopy['parentInstanceId'] = parentInstanceId
      let parent = await instancesStore_async.get(parentInstanceId)
      if (parent?.address) { taskCopy['address'] = parent.address }
      if (!threadId) {
        threadId = parent.threadId
      }
      parent.childInstance = instanceId
      await instancesStore_async.set(parentInstanceId, parent)
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
    console.log("New task " + id)
    return taskCopy
}
  
router.post('/update', async (req, res) => {
    console.log("/api/task/update")
    let userId = DEFAULT_USER
    if (process.env.AUTHENTICATION === "cloudflare") {
      userId = req.headers['cf-access-authenticated-user-email'];
    }
    if (userId) {
      //console.log("req.body " + JSON.stringify(req.body))
      const sessionId = req.body.sessionId;
      let task = req.body.task;
      let address = req.body.address;
      
      task.sessionId = sessionId
      if (sessionId) { task['sessionId'] = sessionId } else {console.log("Warning: sessionId missing")}
      if (address) { task['address'] = address }
  
      // Risk that client writes over server fields so filter_out before merge
      let instanceId = task.instanceId
      const server_side_task = await instancesStore_async.get(instanceId)
      // filter_out could also do some data cleaning
      let clean_client_task = utils.filter_out(tasks, task)
      let updated_task = Object.assign({}, server_side_task, clean_client_task)
  
      /*
      console.log("task ", task)
      console.log("clean_client_task ", clean_client_task)
      console.log("server_side_task ", server_side_task)
      console.log("Merged task: ",updated_task)
      */
  
      if (updated_task?.done) {
        console.log("Client side task done " + updated_task.id)
        updated_task.done = false
        await instancesStore_async.set(instanceId, updated_task)
        updated_task = await newTask_async(updated_task.next, sessionId, null, updated_task)
      } else {
        updated_task = await do_task_async(updated_task)
      }
  
      let i = 0
      while (updated_task?.server_task) {
        // A sanity check to avoid erroneuos infinite loops
        i = i + 1
        if (i > 10) {
          console.log("Unexpected looping on server_task " + updated_task.id)
          exit
        }
        if (updated_task?.done) {
          console.log("Server side task done " + updated_task.id)
          updated_task.done = false
          await instancesStore_async.set(updated_task.instanceId, updated_task)
          updated_task = await newTask_async(updated_task.next, sessionId, null, updated_task)
        }
        if (updated_task?.server_task) {
          updated_task = await do_task_async(updated_task)
        } else {
          break
        }
      }
  
      let updated_client_task = utils.filter_out(tasks, updated_task)
      res.send(JSON.stringify(updated_client_task));
    } else {
      res.status(200).json({ error: "No user" });
    }
});
  
router.post('/start', async (req, res) => {
    console.log("/api/task/start")
    let userId = DEFAULT_USER
    if (process.env.AUTHENTICATION === "cloudflare") {
      userId = req.headers['cf-access-authenticated-user-email'];
    }
    if (userId) {
      //console.log("req.body " + JSON.stringify(req.body))
      const sessionId = req.body.sessionId;
      const startId = req.body.startId;
      const threadId = req.body?.threadId;
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
  
        //console.log(task)
  
        // Check if the user has permissions
        if (!utils.authenticatedTask(task, userId, groups)) {
          console.log(task, userId, groups)
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
    
        let updated_client_task = utils.filter_out(tasks, task)
        res.send(JSON.stringify(updated_client_task));
      }
    } else {
      res.status(200).json({ error: "No user" });
    }
});

export default router;