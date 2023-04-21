const TaskFromAgent_async = async function(threadsStore_async, instancesStore_async, chat_callback_async, task) {
  
    console.log("TaskFromAgent task.name " + task.name + " step " + task?.step)
  
    // We have two potential steps: ['response', 'input']
    // We want to receive the task object from the client and from the server
    if (task?.step === 'input') {
      // Nothing to do just updating instance
      /*
      if (current_task.input !== task.input) {
        current_task.input = task.input
        current_task.last_change = Date.now()
        await sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow);
      }
      */
      console.log('Returning task step input')
      return task
    }
  
    // Here we assume we are dealing with response step

    let threadTasks = {}
    const parentId = task.parentId
    if (task?.assemble_prompt || task?.messages_template) {
      // We get the potentially relevant instances 
      // Note we assume task.id is unique in the thread (may not be true)
      const instanceIds = await threadsStore_async.get(task.threadId)
      //console.log("instanceIds ", instanceIds)
      for (const instanceId of instanceIds) {
        const tmp = await instancesStore_async.get(instanceId);
        threadTasks[tmp.id] = tmp;
        console.log("tmp " + tmp.instanceId + " input " + tmp.input)
      }
    }

    //console.log("threadTasks ", threadTasks)
  
    let prompt = ""
    if (task?.assemble_prompt) {
      prompt += task.assemble_prompt.reduce(function(acc, curr) {
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
          if (threadTasks[parentId + '.' + matches[1]][matches[2]] === undefined) {
            console.log("threadTasks " + parentId + '.' + matches[1] + " " + matches[2] + " does not exist")
          }
          // Will crash server if not present
          return acc + threadTasks[parentId + '.' + matches[1]][matches[2]]
        } else {
          return acc + curr
        }
      });
      console.log("Prompt " + prompt)
    } else {
      if (task?.client_prompt) {
        prompt += task.client_prompt
        //console.log("Client prompt " + prompt)
      } else {
        prompt = task.prompt
      }
    }
  
    if (task?.messages_template) {
      console.log("Found messages_template")
      task.messages = JSON.parse(JSON.stringify(task.messages_template)); // deep copy
      // assemble
      task.messages.forEach(message => {
        if (Array.isArray(message['content'])) {
          message['content'] = message['content'].reduce(function(acc, curr) {
            // Currently this assumes the tasks are from the same workflow, could extend this
            const regex = /(^.+)\.(.+$)/;
            const matches = regex.exec(curr);
            if (matches) {
              let substituted = threadTasks[parentId + '.' + matches[1]][matches[2]]
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
      // console.log("task.messages " + JSON.stringify(workflow.tasks[taskName]))
      // Not sure we need this now
      //await sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow)
    }
  
    let response_text = ''
    if (prompt) {
      //workflow.tasks[taskName].prompt = prompt
      task.prompt = prompt
      response_text = await chat_callback_async(task)
    }
    task.response = response_text
    task.last_change = Date.now()
    //await sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow)
    console.log("Returning from tasks.TaskFromAgent ")// + response_text)
    return task
}

export { TaskFromAgent_async }