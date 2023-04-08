var tasks = tasks || {};

tasks.TaskFromAgent_async = async function(sessionsStore, sessionId, workflow, stepKey, prev_stepKey, prompt_response_callback_async, ws) {

  if (!ws) {
    console.log("ws is not defined for sessionId " + sessionId)
  }
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

tasks.TaskShowText_async = async function(sessionsStore, sessionId, workflow, stepKey) {
  const response = workflow.steps[stepKey].text
  console.log("Returning from tasks.TaskShowText")
  return response
};

export { tasks };