/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { Mutex } from 'async-mutex';

const mutexes = new Map();
const releases = new Map();

export function getMutex(key) {
  if (!mutexes.has(key)) {
    mutexes.set(key, new Mutex());
  }
  return mutexes.get(key);
}

export async function taskLock(key) {
  const mutex = getMutex(key);
  const release = await mutex.acquire();
  console.log(`Locked by key: ${key}`);
  releases.set(key, release); // Store the release function by key
}

export function taskRelease(key) {
  const release = releases.get(key);
  if (release) {
    release();
    console.log(`Released lock with key: ${key}`);
    releases.delete(key); // Remove the release function after releasing the lock
  } else {
    // We expect most tasks will not be locked so no need to warn
    //console.warn(`No lock found for key: ${key}`);
  }
}

export function lockOrError(key) {
  const mutex = getMutex(key);
  if (mutex.isLocked()) {
    throw new Error(`Cannot acquire lock for key: ${key}. Already locked.`);
  }

  const release = mutex.acquire();
  console.log(`Locked by key: ${key}`);

  return function releaseLock() {
    release.then((r) => r());
    console.log(`Released lock with key: ${key}`);
  };
}
