/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// eslint-disable-next-line no-unused-vars
const TaskLLMIO_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  const operators = T("operators");
  const operatorLLM = operators["LLM"].module;

  switch (T("state.current")) {
    case "input":
      T("state.current", "stop");
      return T();
    case "response": {
      T("state.current", "receiving");
      T("command", "update");
      T("commandDescription", "Set state to receiving on other Processors");
      break;
    }
    case "receiving": {
      // The response needs to be available for other tasks to point at
      const operatorOut = await operatorLLM.operate_async(wsSendTask, T()); 
      T("output.LLMtext", operatorOut.response.LLM);
      T("state.current", "received");
      T("command", "update");
      T("commandDescription", "Set state to received and provide output.LLMtext");
      break;
    }
    case "error":
      T("error", {message: "Testing an error from SM"});
      break;
    case "start":
    case "received":
    case "display":
    case "wait":
    case "stop":
      console.log(`${T("type")} does nothing in state ${T("state.current")}`);
      return null;
    default:
      console.log("WARNING unknown state : " + T("state.current"));
      return null;
  }

  //T("error", {message: "Testing an error"});
  return T();
};

export { TaskLLMIO_async };
