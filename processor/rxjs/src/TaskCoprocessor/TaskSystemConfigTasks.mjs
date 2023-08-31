/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { buildTree_async } from "./TaskSystemConfigTasks/configTasks.mjs";
import { utils } from "../utils.mjs";

// eslint-disable-next-line no-unused-vars
const TaskSystemConfigTasks_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  /*
   Load the tasks config from Redis
     Where does it get the connection info from ?
       Part of the task configuration
  */

  switch (T("state.current")) {
    case "start": {
      if (T("processor.coProcessingDone")) {
        console.log("Calling buildTree_async");
        const configTree = await buildTree_async();
        T("state.configTree", configTree);
        T("state.last", T("state.current"));
        T("state.current", "response");
        T("command", "update");
      }
      break;
    }
    case "response":
      break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemConfigTasks_async };
