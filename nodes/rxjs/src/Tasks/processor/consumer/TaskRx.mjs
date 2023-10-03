/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
// subscribe.mjs
import { fromEvent } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { MessagingClient } from '#src/messaging';
import { NODE } from "#root/config";
import { PythonRunner } from '#src/pythonRunner';

// eslint-disable-next-line no-unused-vars
const TaskRx_async = async function (wsSendTask, T) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  if (T("processor.command") === "init") {

    console.log("TaskRx init");

    // Prepare the Python script runner
    const pythonRunner = new PythonRunner();
    // Start the runner with a specific Python module
    pythonRunner.start('publish');

    const messagingClient = new MessagingClient(NODE.storage.redisUrl);

    // Observable for logging every message
    const logMessage$ = fromEvent(messagingClient, 'message').pipe(
      map(([channel, message]) => ({ channel, message })),
      filter(({ channel }) => channel === 'channel_from_py')
    );

    let messagePublished = false;

    // Subscribe for logging every message and publishing one
    logMessage$.subscribe({
      next: ({ message }) => {
        console.log(`Received: ${message} on channel_from_py`);
        if (!messagePublished) {
          console.log(`Publishing "Hello World from JS!" to channel_from_js`);
          messagingClient.publish('channel_from_js', `Hello World from JS!`);
          messagePublished = true;
        }
      },
      error: (err) => console.error('Logging error:', err),
      complete: () => console.log('Logging observable complete')
    });

    // Subscribe to the Redis channel
    messagingClient.subscribe('channel_from_py', (err) => {
      if (err) {
        console.error('Failed to subscribe:', err);
      } else {
        console.log('Subscribed to channel_from_py. Waiting for messages...');
      }
    });

  }

  return null;
};

export { TaskRx_async };
