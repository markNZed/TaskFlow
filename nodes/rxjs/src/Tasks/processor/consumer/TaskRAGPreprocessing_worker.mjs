/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { parentPort } from 'worker_threads';

parentPort.on('message', (message) => {
  console.log("Message received on worker: ", message.type, message.text);
  parentPort.postMessage(message.text.toUpperCase());
});

