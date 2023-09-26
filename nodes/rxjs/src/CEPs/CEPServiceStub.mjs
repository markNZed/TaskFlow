/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";

/*
  For TaskChat we want to swap service type openaigpt for openaistub
  root.user.testing.zeroshot.start
*/

async function cep_async(wsSendTask, CEPInstanceId, functionName, task, args) {
  const modifyKey = args.key;
  const value = args.value;
  const type = args.type;
  //task.config.services
  if (task.processor.command === "init" && task?.config?.services) {
    for (const key of Object.keys(task.config.services)) {
      const service = task.config.services[key];
      if (service.type === type) {
        service[modifyKey] = value;
        // TODO: Disabling the cache should be done from the test
        task.config.operators.LLM.useCache = false;
      }
      // Your code logic for each service entry
    }
    utils.logTask(task, "task.config.services setting ", type, modifyKey, value);
    utils.logTask(task, "task.config.services", JSON.stringify(task.config.services, null, 2));
    return;
  }
}

export const CEPServiceStub = {
  cep_async,
} 