/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";

const TaskConversation_async = async function (taskName, wsSendTask, task, CEPFuncs) {
  const T = utils.createTaskValueGetter(task);

  function helloWorld(functionName, wsSendTask, CEPinstanceId, CEPtask, args) {
    console.log("Hello World", args);
  }

  // This shows dynamically registering a CEP 
  // We can also register a CEP by declaring it in ./CEPFunctions.mjs
  CEPFunctions.register("helloWorld", helloWorld);

  console.log(`${taskName} in state ${task.state.current}`);

  return null;
};

export { TaskConversation_async };
