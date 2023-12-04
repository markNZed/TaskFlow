/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { Mutex } from 'async-mutex';
import { utils } from "./utils.mjs";

const mutexes = new Map();
const releases = new Map();
const lockTimes = new Map();

export function getMutex(key) {
  if (!mutexes.has(key)) {
    mutexes.set(key, new Mutex());
  }
  return mutexes.get(key);
}

export async function taskLock(key, description = "") {
  if (key === undefined || key === null) {
    throw new Error("No key provided " + key);
  }
  const mutex = getMutex(key);
  console.log(`${utils.timeNow()} Requesting lock ${key} ${description}`);
  const requestTime = Date.now();
  const release = await mutex.acquire();
  const duration = Date.now() - requestTime;
  console.log(`${utils.timeNow()}Got lock ${key} after ${duration} ${description}`);
  releases.set(key, release); // Store the release function by key
  lockTimes.set(key, Date.now());
  return release;
}

export function taskRelease(key, description = "") {
  const release = releases.get(key);
  if (release) {
    release();
    releases.delete(key); // Remove the release function after releasing the lock
    const duration = Date.now() - lockTimes.get(key);
    console.log(`${utils.timeNow()} Released lock ${key} after ${duration} ${description}`);
  } else {
    // We expect most tasks will not be locked so no need to warn
    //console.warn(`No lock found for key: ${key}`);
  }
}

export function lockOrError(key, description = "") {
  const mutex = getMutex(key);
  if (mutex.isLocked()) {
    throw new Error(`Cannot acquire lock for key: ${key}. Already locked. ${description}`);
  }
  const release = mutex.acquire();
  console.log(`${utils.timeNow()}Locked ${description} by id: ${key}`);
  return function releaseLock() {
    release.then((r) => r());
    console.log(`${utils.timeNow()}Released lock ${description} with id: ${key}`);
  };
}
