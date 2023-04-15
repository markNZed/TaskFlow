import * as tf from '@tensorflow/tfjs-node';
import * as use from '@tensorflow-models/universal-sentence-encoder';

var tasks = tasks || {};

const model = await use.load();

const cosineSimilarity = (tensor1, tensor2) => {
  const negativeCosineSimilarity = tf.metrics.cosineProximity(tensor1, tensor2);
  return negativeCosineSimilarity.mul(-1).dataSync()[0];
};

tasks.TaskFromAgent_async = async function(sessionsStore_async, sessionId, workflow, taskName, prompt_response_callback_async, task, workflowId) {

  const current_task = workflow.tasks[taskName]

  console.log("TaskFromAgent taskName " + taskName + " step " + task?.step)

  // We have two potential steps: ['response', 'input']
  // We want to receive the task object from the client and from the server
  if (task?.step === 'input') {
    if (current_task.input !== task.input) {
      current_task.input = task.input
      current_task.last_change = Date.now()
      await sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow);
    }
    console.log('returning current_task')
    return current_task
  }

  // Here we assume we are dealing with response step

  let prompt = ""
  if (current_task?.assemble_prompt) {
    prompt += current_task.assemble_prompt.reduce(function(acc, curr) {
      // Currently this assumes the parts are from the same workflow, could extend this
      const regex = /(^.+)\.(.+$)/;
      const matches = regex.exec(curr);
      if (matches) {
        // console.log("matches task " + matches[1] + " " + matches[2])
        if (workflow.tasks[matches[1]] === undefined) {
          console.log("workflow.tasks " + matches[1] +" does not exist")
        }
        if (workflow.tasks[matches[1]][matches[2]] === undefined) {
          console.log("workflow.tasks " + matches[1] + " " + matches[2] + " does not exist")
        }
        // Will crash server if not present
        return acc + workflow.tasks[matches[1]][matches[2]]
      } else {
        return acc + curr
      }
    });
    console.log("Prompt " + prompt)
  } else {
    if (workflow.tasks[taskName]?.prompt) {
      prompt += workflow.tasks[taskName].prompt
      //console.log("Server prompt " + prompt)
    } else if (task?.prompt) { // The case with chat where client sets prompt
      prompt += task.prompt
      //console.log("Client prompt " + prompt)
    }
    
  }

  if (current_task?.messages_template) {
    console.log("Found messages_template")
    current_task.messages = JSON.parse(JSON.stringify(current_task.messages_template)); // deep copy
    // assemble
    current_task.messages.forEach(message => {
      if (Array.isArray(message['content'])) {
        message['content'] = message['content'].reduce(function(acc, curr) {
          // Currently this assumes the tasks are from the same workflow, could extend this
          const regex = /(^.+)\.(.+$)/;
          const matches = regex.exec(curr);
          if (matches) {
            let substituted = workflow.tasks[matches[1]][matches[2]]
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
    // console.log("current_task.messages " + JSON.stringify(workflow.tasks[taskName]))
    await sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow)
  }

  let response_text = ''
  if (prompt) {
    workflow.tasks[taskName].prompt = prompt
    response_text = await prompt_response_callback_async(sessionId, workflowId, workflow.tasks[taskName])
  }
  workflow.tasks[taskName].response = response_text
  workflow.tasks[taskName].last_change = Date.now()
  await sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow)
  console.log("Returning from tasks.TaskFromAgent ") // + response_text)
  return workflow.tasks[taskName]
};

tasks.TaskShowResponse_async = async function(sessionsStore_async, sessionId, workflow, taskName, prompt_response_callback_async, task, workflowId) {

  console.log("TaskShowResponse taskName " + taskName)

  const current_task = workflow.tasks[taskName]

  let response = ''
  if (current_task?.assemble_response) {
    response += current_task.assemble_response.reduce(function(acc, curr) {
      // Currently this assumes the parts are from the same workflow, could extend this
      const regex = /(^.+)\.(.+$)/;
      const matches = regex.exec(curr);
      if (matches) {
        // console.log("matches task " + matches[1] + " " + matches[2])
        if (workflow.tasks[matches[1]] === undefined) {
          console.log("workflow.tasks " + matches[1] +" does not exist")
        }
        if (workflow.tasks[matches[1]][matches[2]] === undefined) {
          console.log("workflow.tasks " + matches[1] + " " + matches[2] + " does not exist")
        }
        // Will crash server if not present
        return acc + workflow.tasks[matches[1]][matches[2]]
      } else {
        return acc + curr
      }
    });
    console.log("Assembled response " + prompt)
  } else {
    response = workflow.tasks[taskName].response
  }
  console.log("Returning from tasks.TaskShowResponse")
  workflow.tasks[taskName].response = response
  sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow)
  return workflow.tasks[taskName]
}

tasks.TaskChoose_async = async function(sessionsStore_async, sessionId, workflow, taskName, prompt_response_callback_async, task, workflowId) {
  // First we get the response
  console.log("TaskChoose taskName " + taskName)

  workflow.tasks[taskName].response = null // Avoid using previously stored response
  let subtask = await tasks.TaskFromAgent_async(sessionsStore_async, sessionId, workflow, taskName, prompt_response_callback_async, task, workflowId) 

  const current_task = workflow.tasks[taskName]

  const next_responses = Object.keys(current_task.next_template)
  const next_states = Object.values(current_task.next_template)
  
  const phrases = [subtask.response, ...next_responses];
  
  try {
    const embeddingsData = await model.embed(phrases);
    const next_embeddings = tf.split(embeddingsData, phrases.length, 0);
    // Do something with next_embeddings
    const response_embedding = next_embeddings[0]; // The first embedding corresponds to response_text.

    const similarities = [];
  
    for (let i = 1; i < next_embeddings.length; i++) {
      const similarity = cosineSimilarity(response_embedding, next_embeddings[i]);
      similarities.push(similarity);
    }
  
    console.log('Similarities:', similarities);
  
    const maxSimilarity = Math.max(...similarities);
    const maxIndex = similarities.indexOf(maxSimilarity);
  
    console.log('Max similarity:', maxSimilarity);
    console.log('Index of max similarity:', maxIndex);
  
    console.log('response is' + next_states[maxIndex])
  
    // Remember to clean up tensors to prevent memory leaks
    embeddingsData.dispose();
  
    // Need to go to next state, can stay on server side
    workflow.tasks[taskName].next = next_states[maxIndex]

    sessionsStore_async.set(sessionId + workflow.id + 'workflow', workflow)

  } catch (error) {
    // Handle the error here
    console.error('An error occurred:', error);
    workflow.tasks[taskName].error = error.message
  }
  
  return workflow.tasks[taskName]

}

tasks.TaskChat_async = async function(sessionsStore_async, sessionId, workflow, taskName, prompt_response_callback_async, task, workflowId) {

  console.log("TaskChat taskName " + taskName)

  workflow.tasks[taskName].response = null // Avoid using previously stored response
  let subtask = await tasks.TaskFromAgent_async(sessionsStore_async, sessionId, workflow, taskName, prompt_response_callback_async, task, workflowId) 

  return subtask

}

export { tasks };