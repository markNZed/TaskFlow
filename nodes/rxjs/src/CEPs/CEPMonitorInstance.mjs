/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { commandUpdate_async } from "#src/commandUpdate";

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {
  let syncUpdateTask = {
    command: "update",
    commandArgs: {
      sync: true,
      instanceId: CEPInstanceId,
      syncTask: {
        response: {
          monitoredTask: task
        },
      }
    },
    commandDescription: `Sending monitored task ${task.instanceId} to monitor task ${CEPInstanceId}`,
  };
  utils.logTask(task, `CEPMonitorInstance monitoring`);
  await commandUpdate_async(wsSendTask, syncUpdateTask);
}

export const CEPMonitorInstance = {
  cep_async,
} 

