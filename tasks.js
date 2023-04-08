import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

var tasks = tasks || {};

const model = await use.load();

const cosineSimilarity = (tensor1, tensor2) => {
  const negativeCosineSimilarity = tf.metrics.cosineProximity(tensor1, tensor2);
  return negativeCosineSimilarity.mul(-1).dataSync()[0];
};

tasks.TaskFromAgent_async = async function(sessionsStore, sessionId, workflow, stepKey, prev_stepKey, prompt_response_callback_async, ws) {

  const current_step = workflow.steps[stepKey]
  const prev_step = workflow.steps[prev_stepKey]

  if (current_step?.last_change && prev_step?.last_change) {
    if (prev_step.last_change > current_step.last_change) {
      current_step.response = ''
    }
  }

  if (current_step?.response && current_step.response !== undefined) {
    console.log("tasks.TaskFromAgent already has response")
    return current_step?.response
  }

  let prompt = ""
  if (current_step?.assemble_prompt) {
    prompt += current_step.assemble_prompt.reduce(function(acc, curr) {
      // Currently this assumes the parts are from the same workflow, could extend this
      const regex = /(^.+)\.(.+$)/;
      const matches = regex.exec(curr);
      if (matches) {
        // console.log("matches step " + matches[1] + " " + matches[2])
        if (workflow.steps[matches[1]] === undefined) {
          console.log("workflow.steps " + matches[1] +" does not exist")
        }
        if (workflow.steps[matches[1]][matches[2]] === undefined) {
          console.log("workflow.steps " + matches[1] + " " + matches[2] + " does not exist")
        }
        // Will crash server if not present
        return acc + workflow.steps[matches[1]][matches[2]]
      } else {
        return acc + curr
      }
    });
    console.log("Prompt " + prompt)
  } else {
    if (workflow.steps[stepKey]?.prompt) {
      prompt += workflow.steps[stepKey]?.prompt
    }
  }

  if (current_step?.messages_template) {
    console.log("Found messages_template")
    current_step.messages = JSON.parse(JSON.stringify(current_step.messages_template)); // deep copy
    // assemble
    current_step.messages.forEach(message => {
      if (Array.isArray(message['content'])) {
        message['content'] = message['content'].reduce(function(acc, curr) {
          // Currently this assumes the steps are from the same workflow, could extend this
          const regex = /(^.+)\.(.+$)/;
          const matches = regex.exec(curr);
          if (matches) {
            let substituted = workflow.steps[matches[1]][matches[2]]
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
    await sessionsStore.set(sessionId + workflow.id + 'workflow', workflow)
  }

  let response_text = await prompt_response_callback_async(sessionId, prompt, ws, stepKey)
  workflow.steps[stepKey].response = response_text
  workflow.steps[stepKey].last_change = Date.now()
  await sessionsStore.set(sessionId + workflow.id + 'workflow', workflow)
  console.log("Returning from tasks.TaskFromAgent " + response_text)

  return response_text
};

tasks.TaskShowResponse_async = async function(sessionsStore, sessionId, workflow, stepKey, prev_stepKey, prompt_response_callback_async, ws) {
  const response = workflow.steps[stepKey].response
  console.log("Returning from tasks.TaskShowResponse")
  return response
};

tasks.TaskChoose_async = async function(sessionsStore, sessionId, workflow, stepKey, prev_stepKey, prompt_response_callback_async, ws) {
  // First we get the response

  let response_text = await tasks.TaskFromAgent_async(sessionsStore, sessionId, workflow, stepKey, prev_stepKey, prompt_response_callback_async, ws) 

  const current_step = workflow.steps[stepKey]
  //current_step.next_template: { true: 'stop', false: 'stop' },

  const next_responses = Object.keys(current_step.next_template)
  const next_states = Object.values(current_step.next_template)
  
  const phrases = [response_text, ...next_responses];

  console.log("phrases " + JSON.stringify(phrases))
  
  const embeddingsData = await model.embed(phrases);

  const next_embeddings = tf.split(embeddingsData, phrases.length, 0);

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

  return next_states[maxIndex]

}

export { tasks };