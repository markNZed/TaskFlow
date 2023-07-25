/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// .env is intended to allow for config that is not under version control
import { appLabel, appName, appAbbrev } from "./src/shared/config.mjs"
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import * as dotenv from "dotenv";
dotenv.config();

const TASKHUB_URL = process.env.TASKHUB_URL || "http://localhost:5001/hub";
const hubSocketUrl = process.env.hubSocketUrl || "ws://localhost:5001/hub/ws";

let CACHE_ENABLE = true;
if (process.env.CACHE_ENABLE !== undefined) {
  CACHE_ENABLE = process.env.CACHE_ENABLE === "true"
}
console.log("CACHE_ENABLE " + CACHE_ENABLE);

const DEFAULT_USER = "test@testing.com";
// For teting we can map one user to any ohter user e.g.
// MAP_USER_JSON={ "dev@email.com" : "user@email.org" }
let MAP_USER = {};
if (process.env.MAP_USER_JSON) {
  MAP_USER = JSON.parse(process.env.MAP_USER_JSON)
  console.log("MAP_USER ", MAP_USER);
}

const CONFIG_DIR = process.env.CONFIG_DIR || "./config";

let processorId;
const processorIdFile = './db/processorId.txt';
try {
    // Try to read the id from a file
    processorId = fs.readFileSync(processorIdFile, 'utf-8');
} catch (e) {
    // If the file does not exist, generate a new id
    processorId = "rxjs-" + uuidv4();
    // Save the id to a file for future use
    fs.writeFileSync(processorIdFile, processorId);
}

const coprocessor = true;

console.log(`Processor ID: ${processorId}`);

export { DEFAULT_USER, CACHE_ENABLE, MAP_USER, appLabel, appName, appAbbrev, TASKHUB_URL, CONFIG_DIR, hubSocketUrl, processorId, coprocessor };
