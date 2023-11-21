/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "./utils.mjs";

async function commandReload_async(wsSendTask, task) {

  utils.logTask(task, "Reload exiting");

  process.exit(0);

}

export { commandReload_async };