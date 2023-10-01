/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { CEPregister } from "#src/taskCEPs";

// eslint-disable-next-line no-unused-vars
const TaskCEPHelloWorld_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  function CEPHelloWorld(wsSendTask, CEPInstanceId, CEPtask, args) {
    utils.logTask(T(), "Hello World", args);
  }

  // This shows dynamically registering a CEP 
  // We can also place CEP in src/CEPs and they will be registered
  CEPregister("CEPHelloWorld", CEPHelloWorld);

  return null;
};

export { TaskCEPHelloWorld_async };
