/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/*
  CEP that will look after task.shared
    Detect when shared has changed
    Maintain a list of Tasks that must be updated
    During init set thee content of task.shared
    Organise by familyId 
    If there is no familyId then match all familyIds
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";

// eslint-disable-next-line no-unused-vars
const TaskSystemShared_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  async function CEPShared(functionName, wsSendTask, CEPinstanceId, task, args) {
    utils.logTask(task, "Shared");
  }

  switch (T("state.current")) {
    case "start": {
      if (!T("processor.coProcessingDone")) {
        CEPFunctions.register("CEPShared", CEPShared);
      }
      break;
    }
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemShared_async };
