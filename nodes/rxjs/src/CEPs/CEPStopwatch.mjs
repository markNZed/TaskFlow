/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";

/*

Could inspire similar featurse e.g. CEPTime, CEPCron could do some of this, CEPAlarm (one off), stats ? 

*/

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {

  const T = utils.createTaskValueGetter(task);
  const coprocessing = task.node.coprocessing || false;

  // We could support commands like start, stop, pause, resume

  // Because we may install this CEP using the task that it is intended to run on we cannot assume it sees the init command
  if (coprocessing && ["update"].includes(task.node.command)) {
    const templatePaths = args.templatePaths;
    if (!templatePaths) {
      utils.logTask(task, "No templatePaths for CEPStopwatch");
      return;
    }
    // Create a new Date object for the current time
    const now = new Date();
    // Format the date and time in a human-readable format (e.g., "YYYY-MM-DD HH:MM:SS")
    const formattedTime = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' + // Months are zero-indexed in JavaScript
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');
    const cepPath = "ceps.data.CEPStopwatch"; // How can we know the id of the cep?
    for (const templatePath of templatePaths) {
      utils.logTask(task, "templatePath", templatePath);
      const templateCopyPath = cepPath + "." + templatePath;
      let init = false;
      if (!T(templateCopyPath)) {
        T(templateCopyPath, T(templatePath));
        // We could copy template into task.ceps (how do we know the id of the cep?)
        // But then we will not be able to pick up changes 
        init = true;
      }
      let template = T(templateCopyPath);
      if (template && typeof template === "string") {
        if (init) {
          template = template.replace('%CEP_STOPWATCH_START%', formattedTime);
          T(templateCopyPath, template)
        }
        // Problem here is that we replace %CEP_STOPWATCH% and will not be able to find it again
        template = template.replace('%CEP_STOPWATCH%', formattedTime);
        utils.logTask(task, "CEPStopwatch replacing CEP_STOPWATCH");
        T(templatePath, template); // We do not update templateCopyPath because we need to keep %CEP_STOPWATCH% for future use
      } else {
        utils.logTask(task, "template is not a string");
      }
    }
  }

}

export const CEPStopwatch = {
  cep_async,
} 