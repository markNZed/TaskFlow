/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { CEPCreate } from "#src/taskCEPs";
import { getActiveTask_async, keysActiveTask_async } from "#src/storage";

/*
  For TaskChat we want to swap service type openaigpt for openaistub
  root.user.testing.zeroshot.start
*/

// eslint-disable-next-line no-unused-vars
const TaskEdit_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  switch (T("state.current")) {
    case "start": {
      break;
    }
    case "input": {
      break;
    }
    case "monitorTask": {
      let monitorInstanceId = T("request.monitorInstanceId");
      utils.logTask(T(), `monitorTask ${monitorInstanceId}`);
      let monitoredTask = await getActiveTask_async(monitorInstanceId);
      if (!monitoredTask) {
        const allKeys = await keysActiveTask_async();
        console.log("allKeys", allKeys);
        if (allKeys) {
          const closest = findClosestKey(allKeys, monitorInstanceId);
          if (closest) {
            monitorInstanceId = closest;
          }
          monitoredTask = await getActiveTask_async(monitorInstanceId);
        }
      }
      if (!monitoredTask) {
        console.log("Could not find task for " + monitorInstanceId);
      }
      const match = ".*instance-" + monitorInstanceId;
      const config = {
        CEPName: "CEPMonitorInstance",
        isRegex: true,
      }
      CEPCreate(CEPMatchMap, T(), match, config);
      T({
        "state.current": "monitoringTask",
        "response.monitoredTask": monitoredTask,
        "command": "update",
        "commandDescription": `Now monitoring ${monitorInstanceId}`,
      });
      break;
    }
    case "monitoringTask": {
      break;
    }
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

function findClosestKey(allKeys, startingString) {
  // Filter keys that start with the desired string.
  const matchingKeys = allKeys.filter(key => key.startsWith(startingString));
  // Find the "closest" match. Here we take the shortest key as "closest".
  const closestKey = matchingKeys.reduce((closest, key) => {
    return (key.length < closest.length) ? key : closest;
  }, matchingKeys[0] || '');
  return closestKey;
}

export { TaskEdit_async };