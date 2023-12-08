/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
//import * as parser from 'cron-parser';
import { CronJob } from 'cron';
import { commandUpdate_async } from "#src/commandUpdate";
import { cronJobsMap } from "#src/storage";

/*
  For TaskChat we want to swap service type openaigpt for openaistub
  root.user.testing.zeroshot.start
*/

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {

  // We could support commands like start, stop
  // Could get back info like nextDate
  // A sync request could be updated on the fly if it were running on CoPro
  //   Could have task.cron.config  task.cron.request task.cron.response (this seems good)
  //   Could have task.cron.command task.cron.commandArgs
  // e.g. read the value of a cron (but we can see the config)

  // Note CronJob include a 6th (additional) seconds field but https://crontab.guru is a help for setting cronTime

  // https://cronitor.io is interesting as a monitor, could just check the login page is alive

  if (task.node.command === "init" && task.cron && Object.keys(task.cron).length > 0) {
    // Each cron job has a name
    for (const [key, value] of Object.entries(task.cron)) {
      console.log(`Init cron: ${key} with:`, utils.js(value));
      const job = new CronJob(value.cronTime, function () {
        console.log(`CEPCron running for ${key}`);
        let syncUpdateTask = {
          command: "update",
          commandArgs: {
            sync: true,
            instanceId: task.instanceId,
            cronEvent: true,
          },
          commandDescription: `Cron job ${key}`,
        };
        if (value.syncTask) {
          syncUpdateTask.commandArgs.syncTask = value.syncTask;
        }
        commandUpdate_async(wsSendTask, syncUpdateTask);
      });
      if (value.start) {
        job.start();
      }
      cronJobsMap.set(key, job);
    }
  }

  // This should support adding a new cron job and also modifying an existing cron job
  if (task.node.command === "update" && task.meta.modified.cron) {
    // Each cron job has a name
    for (const [key, value] of Object.entries(task.cron)) {
      if (task.meta.modified.cron[key]) {
        const oldJob = cronJobsMap.get(key);
        if (oldJob) {
          oldJob.stop();
          console.log(`Replace cron: ${key} with:`, utils.js(value));
        } else {
          console.log(`Init cron: ${key} with:`, utils.js(value));
        }
        const job = new CronJob(value.cronTime, function () {
          console.log(`CEPCron running for ${key}`);
          let syncUpdateTask = {
            command: "update",
            commandArgs: {
              sync: true,
              instanceId: task.instanceId,
              cronEvent: true,
            },
            commandDescription: `Cron job ${key}`,
          };
          if (value.syncTask) {
            syncUpdateTask.commandArgs.syncTask = value.syncTask;
          }
          commandUpdate_async(wsSendTask, syncUpdateTask);
        });
        if (value.start) {
          job.start();
        }
      }
    }
  }

}

export const CEPCron = {
  cep_async,
} 