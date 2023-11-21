/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

async function commandStart_async(wsSendTask, task) {

  try {
    await wsSendTask(task);
  } catch (error) {
    console.error(`Command ${task.command} failed to fetch ${error}`);
  }

}

export { commandStart_async };