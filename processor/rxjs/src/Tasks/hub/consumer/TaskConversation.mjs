/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { CEPFunctions } from "#src/CEPFunctions";

// eslint-disable-next-line no-unused-vars
const TaskConversation_async = async function (wsSendTask, T, fsmHolder, CEPFuncs, services) {

  function CEPHelloWorld(functionName, wsSendTask, CEPinstanceId, CEPtask, args) {
    utils.logTask(T(), "Hello World", args);
  }

  // This shows dynamically registering a CEP 
  // We can also register a CEP by declaring it in ./CEPFunctions.mjs
  CEPFunctions.register("CEPHelloWorld", CEPHelloWorld);

  return null;
};

export { TaskConversation_async };
