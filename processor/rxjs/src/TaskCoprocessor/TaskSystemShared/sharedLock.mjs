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

export async function sharedLock(key) {
  const mutex = getMutex(key);
  const release = await mutex.acquire();
  console.log(`Locked by key: ${key}`);
  releases.set(key, release); // Store the release function by key
}

export function sharedRelease(key) {
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

export function sharedLockOrError(key) {
  const mutex = getMutex(key);
  if (mutex.isLocked()) {
    throw new Error(`Cannot acquire lock for key: ${key}. Already locked.`);
  }
  let releaseFunction;
  mutex.acquire().then((release) => {
    releaseFunction = release;
    console.log(`Locked by key: ${key}`);
    releases.set(key, release); // Store the release function by key
  });
  return function releaseLock() {
    if (releaseFunction) {
      releaseFunction();
      console.log(`Released lock with key: ${key}`);
    }
  };
}
