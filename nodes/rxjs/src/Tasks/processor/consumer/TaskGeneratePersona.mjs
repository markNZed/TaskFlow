/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// eslint-disable-next-line no-unused-vars
const TaskGeneratePersona_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations
  
  const operators = T("operators");
  const operatorLLM = operators["LLM"].module;

  switch (T("state.current")) {
    case "generated":
      console.log(`${T("type")} does nothing in state ${T("state.current")}`);
      return null
    case "start": {
      T("request.prompt", "Generate a random client profile");
      T("request.service.noStreaming", true);
      let operatorOut = await operatorLLM.operate_async(wsSendTask, T());
      T("output.profile", operatorOut.response.LLM);
      T("request.service.systemMessage", "Generate a 100 word, single paragraph, summary of a client profile: ");
      T("request.prompt", T("output.profile"));
      const forget = T("request.service.forget");
      T("request.service.noStreaming", false);
      operatorOut = await operatorLLM.operate_async(wsSendTask, T());
      T("output.summary", operatorOut.response.LLM);
      T("request.service.forget", forget);
      T("state.request", {}); // clear - do we need to do this here?
      T("state.current", "generated");
      T("command", "update");
      T("commandDescription", "Set state to generated and provide output.profile and output.summary");
      break;
    }
    case "wait":
      console.log(`${T("type")} waiting in state ${T("state.current")}`);
      break;
    default:
      console.log("ERROR unknown state : " + T("state.current"));
  }

  return T();
};

export { TaskGeneratePersona_async };
