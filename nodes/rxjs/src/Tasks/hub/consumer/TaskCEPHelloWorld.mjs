/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { CEPregister,CEPCreate } from "#src/taskCEPs";

// Demonstration of establishing a CEP that functions across Task families using a secret
// Demonstration of registering a CEP function that is defiend inside a task from within a task
// Demonstration of creating a CEP from inside a task instead of the config
// TaskCEPHelloWorld is autostarted which in turn starts CEPHelloWorld
// TaskCEPHelloWorld and TaskHelloWorld share a CEPSecret
// When CEPHelloWorld starts the hub consumer porcessor will log "Hello World!"

// eslint-disable-next-line no-unused-vars
const TaskCEPHelloWorld_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  // eslint-disable-next-line no-unused-vars
  function CEPHelloWorld(wsSendTask, CEPInstanceId, CEPtask, args) {
    utils.logTask(T(), "Hello World!");
  }

  // This shows dynamically registering a CEP 
  CEPregister("CEPHelloWorld", CEPHelloWorld);

  const match = "CEPSecret-" + T("config.local.CEPSecret");
  const config = {
    CEPName: "CEPHelloWorld",
    isSingleton: true,
  }
  CEPCreate(CEPMatchMap, T(), match, config);

  return null;
};

export { TaskCEPHelloWorld_async };
