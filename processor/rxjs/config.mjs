/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// .env is intended to allow for config that is not under version control
import { appLabel, appName, appAbbrev, REDIS_URL, MONGO_URL, EMPTYDBS } from "./src/shared/config.mjs"
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import * as dotenv from "dotenv";
dotenv.config();
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TASKHUB_URL = process.env.TASKHUB_URL || "http://localhost:5001/hub";
const hubSocketUrl = process.env.hubSocketUrl || "ws://localhost:5001/hub/ws";

let CACHE_ENABLE = true;
if (process.env.CACHE_ENABLE !== undefined) {
  CACHE_ENABLE = process.env.CACHE_ENABLE === "true"
}
console.log("CACHE_ENABLE " + CACHE_ENABLE);

let DUMMY_OPENAI = false;
if (process.env.DUMMY_OPENAI !== undefined) {
  DUMMY_OPENAI = process.env.DUMMY_OPENAI === "true"
}
if (process.env.OPENAI_API_KEY === "") {
  DUMMY_OPENAI = true;
}
console.log("DUMMY_OPENAI " + DUMMY_OPENAI);

let ENVIRONMENT = "rxjs";
if (process.env.ENVIRONMENT !== undefined) {
  ENVIRONMENT = process.env.ENVIRONMENT;
}
console.log("ENVIRONMENT " + ENVIRONMENT);

const DEFAULT_USER = "test@testing.com";
// For teting we can map one user to any ohter user e.g.
// MAP_USER_JSON={ "dev@email.com" : "user@email.org" }
let MAP_USER = {};
if (process.env.MAP_USER_JSON) {
  MAP_USER = JSON.parse(process.env.MAP_USER_JSON)
  console.log("MAP_USER ", MAP_USER);
}

let COPROCESSOR = false;
let WS_PORT;

switch (ENVIRONMENT) {
  case "rxjs":
    WS_PORT = 5002;
    break;
  case "rxjscopro":
    COPROCESSOR = true;
    WS_PORT = 5003;
    break;
  case "nodejs":
    WS_PORT = 5000;
    break;
  default:
    throw new Error("Unknown environment " + ENVIRONMENT);
}

console.log("COPROCESSOR", COPROCESSOR);

const CONFIG_DIR = process.env.CONFIG_DIR + ENVIRONMENT || path.join(__dirname, './config/' + ENVIRONMENT);
console.log("CONFIG_DIR", CONFIG_DIR);


let processorId;
let processorIdFile = './db/processor' + ENVIRONMENT + 'Id.txt';
try {
    // Try to read the id from a file
    processorId = fs.readFileSync(processorIdFile, 'utf-8');
} catch (e) {
    // If the file does not exist, generate a new id
    processorId = ENVIRONMENT + '-' + uuidv4();
    // Save the id to a file for future use
    fs.writeFileSync(processorIdFile, processorId);
}

if (process.env.WS_PORT) {
  WS_PORT = process.env.WS_PORT;
}

let TASK_DIR;
if (process.env.TASK_DIR) {
  TASK_DIR = process.env.TASK_DIR;
} else {
  TASK_DIR = "Tasks/" + ENVIRONMENT;
}

console.log(`Processor ID: ${processorId}`);

export { DEFAULT_USER, CACHE_ENABLE, DUMMY_OPENAI, MAP_USER, appLabel, appName, appAbbrev, TASKHUB_URL, CONFIG_DIR, hubSocketUrl, processorId, COPROCESSOR, TASK_DIR, WS_PORT, REDIS_URL, MONGO_URL, EMPTYDBS, ENVIRONMENT };
