/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// eslint-disable-next-line no-unused-vars
const TaskConversation_async = async function (wsSendTask, T) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  return null;
};

export { TaskConversation_async };
