/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TaskFromAgent_async } from './TaskFromAgent.mjs';
import { utils } from '../src/utils.mjs'

const TaskChat_async = async function(task) {

    const T = utils.createTaskValueGetter(task)

    console.log("TaskChat meta.name " + T('v02.meta.name'))
  
    T('v02.response.text', null) // Avoid using previously stored response

    // Need to move TaskFromAgent_async to V02 or convert it to V02

    let subtask = await TaskFromAgent_async(task) 

    const ST = utils.createTaskValueGetter(subtask)

    /*
    if (subtask?.v02.state.current && subtask?.v02.state.nextState) {
        subtask.v02.state.current = subtask.v02.state.nextState
    }
    */

    if (ST('v02.state.current') === 'sending') {
        // Should get next user input
        // The websocket will have already switched the Task to this step if it is connected
        ST('v02.state.current', 'input')
    }

    console.log("Returning from tasks.TaskChat_async")

    return subtask
  
}

export { TaskChat_async }