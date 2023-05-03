/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { chat_async } from './TaskChat/chat.mjs';
import { instancesStore_async, threadsStore_async} from '../src/storage.mjs'
import { utils } from '../src/utils.mjs'

const TaskFromAgent_async = async function(task) {
  
  const T = utils.createTaskValueGetter(task)

  console.log("TaskFromAgent meta.name " + T('meta.name') + " step " + T('state.current'))
  
    // We have two potential steps: ['response', 'input']
    // We want to receive the task object from the client and from the server
    if (T('state.current') === 'input') {
      // Nothing to do could update instance
      console.log('Returning task state input')
      return task
    }
  
    // Here we assume we are dealing with response step

    let threadTasks = {}
    const parentId = T('meta.parentId')
    if (T('config.messagesTemplate') || T('config.promptTemplate')) {
      // We get the potentially relevant instances 
      // Note we assume T('meta.id') is unique in the thread (may not be true)
      const instanceIds = await threadsStore_async.get(T('meta.threadId'))
      //console.log("instanceIds ", instanceIds)
      for (const instanceId of instanceIds) {
        const tmp = await instancesStore_async.get(instanceId);
        threadTasks[tmp.meta.id] = tmp;
        //console.log("thread " + tmp.meta.id + " instanceId " + tmp.meta.instanceId + " output " + tmp.output)
      }
    }

    //console.log("threadTasks ", threadTasks)
  
    let prompt = ""
    if (T('config.promptTemplate')) {
      prompt += T('config.promptTemplate').reduce(function(acc, curr) {
        // Currently this assumes the parts are from the same workflow, could extend this
        const regex = /(^.+)\.(.+$)/;
        const matches = regex.exec(curr);
        if (matches) {
          // We need to find the relevant task using the threadId ?
          // like workflow key: threadId + taskId
          // console.log("matches task " + matches[1] + " " + matches[2])
          if (threadTasks[parentId + '.' + matches[1]] === undefined) {
            console.log("threadTasks " + parentId + '.' + matches[1] +" does not exist")
          }
          if (threadTasks[parentId + '.' + matches[1]]['output'] === undefined) {
            console.log("threadTasks " + parentId + '.' + matches[1] + ".output does not exist in", threadTasks[parentId + '.' + matches[1]])
          }
          if (threadTasks[parentId + '.' + matches[1]]['output'][matches[2]] === undefined) {
            console.log("threadTasks " + parentId + '.' + matches[1] + ".output." + matches[2] + " does not exist in", threadTasks[parentId + '.' + matches[1]])
          }
          // Will crash server if not present
          return acc + threadTasks[parentId + '.' + matches[1]]['output'][matches[2]]
        } else {
          return acc + curr
        }
      });
      //console.log("Prompt " + prompt)
    } else {
      if (T('request.input')) {
        prompt += T('request.input')
        //console.log("Client prompt " + prompt)
      } else {
        prompt = T('request.prompt')
      }
    }
  
    if (T('config.messagesTemplate')) {
      console.log("Found messages_template")
      T('request.messages', JSON.parse(JSON.stringify(T('config.messagesTemplate')))) // deep copy
      // assemble
      T('request.messages').forEach(message => {
        if (Array.isArray(message['content'])) {
          message['content'] = message['content'].reduce(function(acc, curr) {
            // Currently this assumes the tasks are from the same workflow, could extend this
            const regex = /(^.+)\.(.+$)/;
            const matches = regex.exec(curr);
            if (matches) {
              let substituted = threadTasks[parentId + '.' + matches[1]]['output'][matches[2]]
              return acc + substituted
            } else {
              if (typeof curr === 'string') {
                return acc + curr;
              } else {
                return acc + JSON.stringify(curr);
              }
            }
          });
        }
      });
      //console.log("T('request.messages') " + JSON.stringify(T('request.messages')))
    }
  
    let response_text = ''
    if (prompt) {
      //workflow.tasks[taskName].prompt = prompt
      T('request.prompt', prompt)
      response_text = await chat_async(task)
    }
    T('response.text', response_text)
    // Make available as an output to other Tasks
    T('output.text', response_text)
    // Ensure we do not overwrite the deltaState on the client
    T('state.deltaState', undefined)
    T('meta.updatedAt', Date.now())
    //await sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow)
    console.log("Returning from tasks.TaskFromAgent ")// + response_text)
    return task
}

export { TaskFromAgent_async }