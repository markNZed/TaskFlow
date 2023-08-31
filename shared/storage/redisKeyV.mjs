/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import Keyv from "keyv";
import KeyvRedis from "@keyv/redis";
import Redis from "ioredis";
import * as dotenv from "dotenv";
import path from 'path';
console.log("Current directory:", path.resolve());
// The path is to the config in app/shared because shared is used through symbolic links
import { REDIS_URL } from "../config.mjs";
dotenv.config();

// I had issue swith the redis library still trying localhost, it works with ioredis
export const redisClient = new Redis(REDIS_URL);
/*
  From the Redic CLI
    CONFIG GET appendonly
    "yes"
    CONFIG GET dir
    "/data"
    CONFIG GET appendfilename
    "appendonly.aof"
    CONFIG GET appendfsync
    "everysec"
*/
redisClient.config("SET", "appendonly", "yes");


redisClient.on('error', function(err) {
  console.log('Could not establish a connection with redis. ' + err);
});

redisClient.on('connect', function() {
  console.log('Connected to redis successfully');
});

class ExtendedKeyvRedis extends KeyvRedis {
  constructor(redisClient, options = {}) {
    super(redisClient, options);
    this.redis = redisClient; // You already have a Redis client; no need to create a new one
    this.namespace = options.namespace; // Store the namespace for later
  }
  async *iterate() {
    let cursor = '0';
    const matchPattern = this.namespace ? `${this.namespace}:*` : null;
    do {
      // Use SCAN to get an array where the first element is the new cursor and the second is the list of keys
      const scanOptions = matchPattern ? ['MATCH', matchPattern] : [];
      const [newCursor, keys] = await this.redis.scan(cursor, ...scanOptions);
      for (const key of keys) {
        let realKey = key;
        // Remove the 'sets:' prefix if it exists
        if (realKey.startsWith('sets:')) {
          realKey = realKey.substring(5);
        }
        // Remove the namespace if it exists
        if (this.namespace && realKey.startsWith(`${this.namespace}:`)) {
          realKey = realKey.substring(this.namespace.length + 1);
        }
        let value = await this.get(key); // Use Keyv's get method to deserialize and get the value
        try {
          if (typeof value === 'string') {
            value = JSON.parse(value);
          }
          if (value && value.value) {
            value = value.value;
          }
        } catch (e) {
          value = null;
        }
        yield { key: realKey, value };
      }
      cursor = newCursor;
    } while (cursor !== '0');
  }
}

/*
// Usage
async function iterateThroughStore() {
  // We must use "key" and "valie" here
  for await (const { key, value } of store.iterate()) {
    console.log(key, value);
  }
}
*/

export function newKeyV(redisClient, namespace) {
  const store = new ExtendedKeyvRedis(redisClient);
  //console.log(`Using Redis Client for ${namespace} with config:`, redisClient.options);
  // Can pass TTL to keyv e.g. 24 hrs
  // const ttl = 1000 * 60 * 60 * 24;
  const keyv = new Keyv({ store, namespace });

  // Attach the iterate method to the keyv instance
  keyv.iterate = async function*() {
    for await (const item of store.iterate()) {
      yield item;
    }
  };

  return keyv;
}