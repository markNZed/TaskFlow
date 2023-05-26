/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { SubTaskLLM_async } from "../SubTask/SubTaskLLM.mjs";
import { utils } from "../src/utils.mjs";

const TaskLLMIO_async = async function (wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(
    "TaskLLMIO name " + T("name") + " state " + T("state.current")
  );

  if (T("state.current") === undefined) {
    console.log("TaskLLMIO state.current is undefined");
    return null
  }

  // We have two potential steps: ['response', 'input']
  // We want to receive the task object from the React Task Processor and from the NodeJS Task Processor
  if (T("state.current") === "input") {
    // Make available to other tasks an output of this task
    if (T("request.input")) {
      T("output.input", T("request.input"));
    } else {
      T("output.input", "");
    }
    console.log("Returning task state input " + JSON.stringify(task));
    return task;
  }

  // Here we assume we are dealing with response state

  let prompt = "";
  if (T("config.promptTemplate")) {
    console.log("Found promptTemplate");
    prompt += T("config.promptTemplate");
    console.log("Prompt " + prompt)
  } else {
    if (T("request.input")) {
      prompt += T("request.input");
      console.log("request.input " + prompt)
    } else {
      prompt = T("request.prompt");
      console.log("request.prompt " + prompt)
    }
  }

  if (T("config.messagesTemplate")) {
    console.log("Found messagesTemplate");
    T("request.messages", T("config.messagesTemplate"))
    console.log("T('request.messages') " + JSON.stringify(T('request.messages')))
  }

  let response_text = "";
  if (prompt) {
    T("request.prompt", prompt);
    // The response needs to be available for other tasks to point at
    const subTask = await SubTaskLLM_async(wsSendTask, task); 
    // Now we always wait for the response
    response_text = await subTask.response.text_promise
    T("response.text", response_text);
    T("output.text", response_text);
  }
  //T("response.text", response_text);
  // Make available as an output to other Tasks
  //T("output.text", response_text);
  // Ensure we do not overwrite the deltaState on the React Task Processor
  T("state.deltaState", undefined);
  T("response.updated", true);
  T("updatedAt", Date.now());
  console.log("Returning from TaskLLMIO "); // + response_text)
  //T("error", "Testing an error");
  return task;
};

export { TaskLLMIO_async };
