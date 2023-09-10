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
import { REDIS_URL, appAbbrev } from "../config.mjs";
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

export function newKeyV(redisClient, namespace) {
  const store = new KeyvRedis(redisClient);
  //console.log(`Using Redis Client for ${namespace} with config:`, redisClient.options);
  // Can pass TTL to keyv e.g. 24 hrs
  // const ttl = 1000 * 60 * 60 * 24;
  namespace += appAbbrev;
  const keyv = new Keyv({ store, namespace });
  return keyv;
}