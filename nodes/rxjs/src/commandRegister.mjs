/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { NODE } from "../config.mjs";
import { utils } from "./utils.mjs";

let hubId;

async function commandRegister_async(wsSendTask, task) {

  hubId = task?.node?.commandArgs?.hubId;

  utils.logTask(task, "hubId", hubId);

  const locale = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || process.env.LC_MESSAGES || 'en';
  const language = locale.split('_')[0];

  let node = utils.deepClone(NODE);
  delete node.id;
  node["nodeId"] = NODE.id;
  node["language"] = language;

  const registerTask = {
    node,
    command: "register",
    commandDescription: `Request ${NODE.id} to register`,
  };

  try {
    await wsSendTask(registerTask);
  } catch (error) {
    console.error(`Command ${registerTask.command} failed to fetch ${error}`);
  }

}

export { commandRegister_async, hubId };