/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/*
  For TaskChat we want to swap service type openaigpt for openaistub
  root.user.testing.zeroshot.start
*/

// eslint-disable-next-line no-unused-vars
const TaskTest_async = async function (wsSendTask, T, fsmHolder, CEPMatchMapMap) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  /*
  CEPFunctions.register("CEPServiceStub", CEPServiceStub);
  CEPFunctions.register("CEPFamilyTree", CEPFamilyTree);

  // Here we install the CEP from the task but this could also be done through the Task config
  const match = "id-" + T("config.local.targetTaskId");
  const config = {
    functionName: "CEPServiceStub",
    args: {
      type: "openaigpt.chatgptzeroshot",
      key: "API", 
      value: "openaistub"
    },
  }
  utils.createCEP(CEPMatchMap, CEPFunctions, T(), match, config);
  */

  return T();
};

export { TaskTest_async };