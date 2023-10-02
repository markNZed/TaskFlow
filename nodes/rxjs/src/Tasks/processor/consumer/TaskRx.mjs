/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
// subscribe.mjs
import { fromEvent } from 'rxjs';
import { map, filter } from 'rxjs/operators';
// Could not use this because client is either listening or sending
//import { redisClient } from "#shared/storage/redisKeyV";
import Redis from 'ioredis';
import { spawn } from 'child_process';
import { NODE } from "#root/config";
import path from "path";
import { fileURLToPath } from "url";

// eslint-disable-next-line no-unused-vars
const TaskRx_async = async function (wsSendTask, T) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  if (T("processor.command") === "init") {

    console.log("TaskRx init");

    let currentDir = path.dirname(fileURLToPath(import.meta.url));

    // Launch the Python Publisher unbuffered
    const pythonPublisher = spawn('python3', ['-u', `${currentDir}/TaskRx/publish.py`]);

    pythonPublisher.on('error', (error) => {
      console.error(`TaskRx Spawn Error: ${error}`);
    });
  
    pythonPublisher.on('close', (code) => {
        console.log(`TaskRx Child process exited with code ${code}`);
    }); 

    pythonPublisher.stderr.on('data', (data) => {
      console.error(`TaskRx Python stderr: ${data.toString()}`);
    });

    pythonPublisher.stdout.on('data', (data) => {
      console.log(`TaskRx Python stdout: ${data.toString()}`);
    }); 

    // Setup Redis client
    const redisClient = new Redis(NODE.storage.redisUrl);
    const redisPublisher = new Redis(NODE.storage.redisUrl);

    // Observable for logging every message
    const logMessage$ = fromEvent(redisClient, 'message').pipe(
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
          redisPublisher.publish('channel_from_js', `Hello World from JS!`);
          messagePublished = true;
        }
      },
      error: (err) => console.error('Logging error:', err),
      complete: () => console.log('Logging observable complete')
    });

    // Subscribe to the Redis channel
    redisClient.subscribe('channel_from_py', (err) => {
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
