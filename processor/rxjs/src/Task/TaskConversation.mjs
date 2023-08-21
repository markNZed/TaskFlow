/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";

const TaskConversation_async = async function (wsSendTask, task, CEPFuncs) {
  const T = utils.createTaskValueGetter(task);

  function helloWorld(functionName, wsSendTask, CEPinstanceId, CEPtask, args) {
    utils.logTask(task, "Hello World", args);
  }

  // This shows dynamically registering a CEP 
  // We can also register a CEP by declaring it in ./CEPFunctions.mjs
  CEPFunctions.register("helloWorld", helloWorld);

  return null;
};

export { TaskConversation_async };
