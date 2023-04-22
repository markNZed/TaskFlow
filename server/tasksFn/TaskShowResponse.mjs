/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

const TaskShowResponse_async = async function(threadsStore_async, instancesStore_async, chat_callback_async, task) {

    console.log("TaskShowResponse task.name " + task.name)

    let threadTasks = {}
    const parentId = task.parentId
    if (task?.assemble_response) {
      // We get the potentially relevant instances 
      // Note we assume task.id is unique in the thread (may not be true)
      const instanceIds = await threadsStore_async.get(task.threadId)
      for (const instanceId of instanceIds) {
        const tmp = await instancesStore_async.get(instanceId);
        threadTasks[tmp.id] = tmp;
      }
    }

    let response = ''
    if (task?.assemble_response) {
      response += task.assemble_response.reduce(function(acc, curr) {
        // Currently this assumes the parts are from the same workflow, could extend this
        const regex = /(^.+)\.(.+$)/;
        const matches = regex.exec(curr);
        if (matches) {
          // console.log("matches task " + matches[1] + " " + matches[2])
          if (threadTasks[parentId + '.' + matches[1]] === undefined) {
            console.log("threadTasks " + parentId + '.' + matches[1] +" does not exist")
          }
          if (threadTasks[parentId + '.' + matches[1]][matches[2]] === undefined) {
            console.log("threadTasks " + parentId + '.' + matches[1] + " " + matches[2] + " does not exist")
          }
          // Will crash server if not present
          return acc + threadTasks[parentId + '.' + matches[1]][matches[2]]
        } else {
          return acc + curr
        }
      });
      console.log("Assembled response " + prompt)
    } else {
      response = task.response
    }
    console.log("Returning from tasks.TaskShowResponse")
    task.response = response
    return task
}

export { TaskShowResponse_async }