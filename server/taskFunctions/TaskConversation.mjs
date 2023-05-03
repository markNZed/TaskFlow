/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from '../src/utils.mjs'

const TaskConversation_async = async function(task) {
 
    const T = utils.createTaskValueGetter(task)

    console.log("Returning from TaskConversation_async")
    
    return task
  
}

export { TaskConversation_async }