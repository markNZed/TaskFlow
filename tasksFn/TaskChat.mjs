import { TaskFromAgent_async } from './TaskFromAgent.mjs';

const TaskChat_async = async function(threadsStore_async, instancesStore_async, chat_callback_async, task) {

    console.log("TaskChat task.name " + task.name)
  
    task.response = null // Avoid using previously stored response
    let subtask = await TaskFromAgent_async(threadsStore_async, instancesStore_async, chat_callback_async, task) 
  
    return subtask
  
}

export { TaskChat_async }