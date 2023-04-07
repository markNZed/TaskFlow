var components = components || {};

components.TaskFromAgent_async = async function(sessionsStore, sessionId, exercise, stepKey, prev_stepKey, prompt_response_callback_async, wsObject) {
  const current_step = exercise.steps[stepKey]
  const prev_step = exercise.steps[prev_stepKey]

  if (current_step?.last_change && prev_step?.last_change) {
    if (prev_step.last_change > current_step.last_change) {
      current_step.response = ''
    }
  }

  if (current_step?.response && current_step.response !== undefined) {
    console.log("components.TaskFromAgent already has response")
    return current_step?.response
  }

  let prompt = ""
  if (current_step?.assemble_prompt) {
    prompt += current_step.assemble_prompt.reduce(function(acc, curr) {
      // Currently this assumes the parts are from the same exercise, could extend this
      const regex = /(^.+)\.(.+$)/;
      const matches = regex.exec(curr);
      if (matches) {
        // console.log("matches step " + matches[1] + " " + matches[2])
        if (exercise.steps[matches[1]] === undefined) {
          console.log("exercise.steps " + matches[1] +" does not exist")
        }
        if (exercise.steps[matches[1]][matches[2]] === undefined) {
          console.log("exercise.steps " + matches[1] + " " + matches[2] + " does not exist")
        }
        // Will crash server if not present
        return acc + exercise.steps[matches[1]][matches[2]]
      } else {
        return acc + curr
      }
    });
    console.log("Prompt " + prompt)
  } else {
    prompt += exercise.steps[stepKey]?.prompt
  }

  if (current_step?.messages_template) {
    console.log("Found messages_template")
    current_step.messages = JSON.parse(JSON.stringify(current_step.messages_template)); // deep copy
    // assemble
    current_step.messages.forEach(message => {
      if (Array.isArray(message['content'])) {
        message['content'] = message['content'].reduce(function(acc, curr) {
          // Currently this assumes the steps are from the same exercise, could extend this
          const regex = /(^.+)\.(.+$)/;
          const matches = regex.exec(curr);
          if (matches) {
            let substituted = exercise.steps[matches[1]][matches[2]]
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
    await sessionsStore.set(sessionId + exercise.id + 'exercise', exercise)
  }

  let response_text = await prompt_response_callback_async(sessionId, prompt, wsObject, false, stepKey)
  exercise.steps[stepKey].response = response_text
  exercise.steps[stepKey].last_change = Date.now()
  await sessionsStore.set(sessionId + exercise.id + 'exercise', exercise)
  console.log("Returning from components.TaskFromAgent " + response_text)
  return response_text
};

components.TaskShowText_async = async function(sessionsStore, sessionId, exercise, stepKey) {
  const response = exercise.steps[stepKey].text
  console.log("Returning from components.TaskShowText")
  return response
};

export { components };