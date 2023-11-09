/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { parentPort } from 'worker_threads';

parentPort.on('message', (message) => {
  console.log(message.type); // 'greeting'
  console.log(message.text); // 'Hello, worker!'
  parentPort.postMessage(message.text.toUpperCase());
});

