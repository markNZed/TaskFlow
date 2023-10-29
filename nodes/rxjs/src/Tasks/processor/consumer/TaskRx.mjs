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
import { utils } from '#src/utils';

// eslint-disable-next-line no-unused-vars
const TaskRx_async = async function (wsSendTask, T) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  if (T("node.command") === "init") {

    utils.logTask(T(), "init");

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
        utils.logTask(T(), `Received: ${message} on channel_from_py`);
        if (!messagePublished) {
          utils.logTask(T(), `Publishing "Hello World from JS!" to channel_from_js`);
          messagingClient.publish('channel_from_js', `Hello World from JS!`);
          messagePublished = true;
        }
      },
      error: (err) => utils.logTask(T(), 'Logging error:', err),
      complete: () => utils.logTask(T(), 'Logging observable complete')
    });

    // Subscribe to the Redis channel
    messagingClient.subscribe('channel_from_py');

  }

  return null;
};

export { TaskRx_async };
