/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TaskFromAgent_async } from './TaskFromAgent.mjs';

const TaskChat_async = async function(task) {

    console.log("TaskChat task.name " + task.name)
  
    task.response = null // Avoid using previously stored response
    let subtask = await TaskFromAgent_async(task) 
  
    console.log("Returning from tasks.TaskChat_async")
    return subtask
  
}

export { TaskChat_async }