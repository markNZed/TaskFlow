/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { threadsStore_async} from './../src/storage.mjs'
import { utils } from '../src/utils.mjs'

const TaskShowResponse_async = async function(task) {

  const T = utils.createTaskValueGetter(task)

  console.log("TaskShowResponse meta.name " + T('meta.name'))

    let threadTasks = {}
    const parentId = T('meta.parentId')
    if (T('config.promptTemplate') || T('config.promptTemplate')) {
      // We get the potentially relevant instances 
      // Note we assume T('meta.id') is unique in the thread (may not be true)
      const instanceIds = await threadsStore_async.get(T('meta.threadId'))
      for (const instanceId of instanceIds) {
        const tmp = await instancesStore_async.get(instanceId);
        threadTasks[tmp.meta.id] = tmp;
      }
    }

    let response = ''
    if (T('config.promptTemplate')) {
      response += T('config.promptTemplate').reduce(function(acc, curr) {
        // Currently this assumes the parts are from the same workflow, could extend this
        const regex = /(^.+)\.(.+$)/;
        const matches = regex.exec(curr);
        if (matches) {
          // console.log("matches task " + matches[1] + " " + matches[2])
          if (threadTasks[parentId + '.' + matches[1]] === undefined) {
            console.log("threadTasks " + parentId + '.' + matches[1] +" does not exist")
          }
          if (threadTasks[parentId + '.' + matches[1]]['output'][matches[2]] === undefined) {
            console.log("threadTasks " + parentId + '.' + matches[1] + ".output." + matches[2] + " does not exist")
          }
          // Will crash server if not present
          return acc + threadTasks[parentId + '.' + matches[1]]['output'][matches[2]]
        } else {
          return acc + curr
        }
      });
      console.log("Assembled response " + prompt)
    } else {
      response = T('response.text')
    }
    console.log("Returning from tasks.TaskShowResponse")
    // Ensure we do not overwrite the deltaState on the client
    T('state.deltaState', undefined)  // Should be centralized?
    T('response.text', response)
    T('meta.updatedAt', Date.now()) // Should be centralized?
    return task
}

export { TaskShowResponse_async }