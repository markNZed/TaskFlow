import { Mutex } from 'async-mutex';

const mutexes = new Map();
const releases = new Map();

export function getMutex(key) {
  if (!mutexes.has(key)) {
    mutexes.set(key, new Mutex());
  }
  return mutexes.get(key);
}

export async function lockResource(key) {
  const mutex = getMutex(key);
  const release = await mutex.acquire();
  console.log(`Locked by key: ${key}`);
  releases.set(key, release); // Store the release function by key
}

export function releaseResource(key) {
  const release = releases.get(key);
  if (release) {
    release();
    console.log(`Released by key: ${key}`);
    releases.delete(key); // Remove the release function after releasing the lock
  } else {
    console.warn(`No lock found for key: ${key}`);
  }
}
