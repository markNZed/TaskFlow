/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";

const TaskSystemTest_async = async function (wsSendTask, task) {
  // eslint-disable-next-line no-unused-vars
  const T = utils.createTaskValueGetter(task);

  return null;
};

export { TaskSystemTest_async };
