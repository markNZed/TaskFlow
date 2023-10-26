/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/*

Enhanced Generation:

    Conditional generation: Tailor the generation based on the context. For example, if a user asks a fact-based question, the answer should be concise. For more open-ended questions, it might be preferable to have a more detailed response.
    Diverse outputs: Use techniques like beam search, top-k sampling, or nucleus sampling to generate diverse and high-quality answers.
    Feedback loop: Implement a feedback system where users can rate or correct the generated responses, which can then be used to improve the generation model further.

*/

// eslint-disable-next-line no-unused-vars
const TaskRAG_async = async function (wsSendTask, T, FSMHolder) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  const operators = T("operators");
  const operatorRAG = operators["RAG"].module;

  let nextState = T("state.current");

  while (!T("command") && nextState) {
    T("state.current", nextState);
    nextState = null;
    switch (T("state.current")) {
      case "start":
        break;
      case "input":
        break;
      case "sent": {
        await operatorRAG.operate_async(wsSendTask, T());
        console.log("Response from TaskRAG", T("response"));
        T("state.current", "response");
        T("command", "update");
        break;
      }
      case "response":
        break;
      default:
        console.log("WARNING unknown state : " + T("state.current"));
    }
    // The while loop can move to next state by assigning nextState
    if (nextState) {
      console.log(`nextState ${nextState}`);
    }
  }

  return T();
};

export { TaskRAG_async };