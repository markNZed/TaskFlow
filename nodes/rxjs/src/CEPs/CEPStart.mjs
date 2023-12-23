/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";

/*
  Generic CEP to intercept start command on the coprocessor
  args.function
  We could call a Task e.g. TaskInterviewCEPStart.mjs that exports a function CEPStart
  We achieve something similar to this with TaskChoose, with the done indicator we can return a different task
  but that requires designing the taskflow with this in mind
*/

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {
  if (task.node.command === "start") {
    utils.logTask(task, "CEPInterceptStart");
  }
}

export const CEPStart = {
  cep_async,
} 