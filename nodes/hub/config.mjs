/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// .env is intended to allow for config that is not under version control
import { appLabel, appName, appAbbrev, REDIS_URL, MONGO_URL, EMPTY_ALL_DB } from "./src/shared/config.mjs"
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import * as dotenv from "dotenv";
import { utils } from "./src/utils.mjs";
dotenv.config();

// This is used for the allowedOrigins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "http://localhost:3000";

const CACHE_ENABLE = process.env.CACHE_ENABLE === "true" || true;
console.log("CACHE_ENABLE " + CACHE_ENABLE);

const DEMO_USER = "demoUser";
// For teting we can map one user to any ohter user e.g.
// MAP_USER_JSON={ "dev@email.com" : "user@email.org" }
let MAP_USER = {};
if (process.env.MAP_USER_JSON) {
  MAP_USER = JSON.parse(process.env.MAP_USER_JSON)
  console.log("MAP_USER", MAP_USER);
}

const DUMP_CONFIGS = process.env.DUMP_CONFIGS || false;

let NODE_NAME = "hub-core";
if (process.env.NODE_NAME !== undefined) {
  NODE_NAME = process.env.NODE_NAME;
}

let CONFIG_DIR = "../config";
if (process.env.CONFIG_DIR !== undefined) {
  CONFIG_DIR = process.env.CONFIG_DIR;
}

let NODE;

switch (NODE_NAME) {
  case "hub-core":
    NODE = {
      type: "hub",
      role: "core",
      processing: ["stream"],
      environment: "rxjs-hub-core",
      wsPort: 5001,
    }
    break;
  default:
    throw new Error("Unknown NODE_NAME " + NODE_NAME);
}

let nodeId;
let nodeIdFile = './db/node-' + NODE_NAME + '-id.txt';
try {
    // Try to read the id from a file
    nodeId = fs.readFileSync(nodeIdFile, 'utf-8');
} catch (e) {
    // If the file does not exist, generate a new id
    nodeId = NODE.environment + '-' + uuidv4();
    // Save the id to a file for future use
    fs.writeFileSync(nodeIdFile, nodeId);
}

NODE["name"] = NODE_NAME;
NODE["configDir"] = CONFIG_DIR + "/" + NODE.name || path.join(__dirname, './config/' + NODE.name);
NODE["dumpConfigs"] = DUMP_CONFIGS;
NODE["allowedOrigins"] = ALLOWED_ORIGINS;
NODE["hubNodeEnvironments"] = ["rxjs-hub-coprocessor", "rxjs-hub-consumer"];
NODE["app"] = {
  label: appLabel,
  name: appName,
  abbrev: appAbbrev,
};
NODE["storage"] = {
  redisUrl: REDIS_URL,
  mongoUrl: MONGO_URL,
  emptyAllDB: EMPTY_ALL_DB,
  mongoMaster: "hub-coprocessor",
  redisMaster: "hub-coprocessor",
};
NODE["id"] = nodeId;
if (process.env.WS_PORT) {
  NODE["wsPort"] = process.env.WS_PORT
}

const NODE_ENV = process.env.NODE_ENV || "production"; //"development"
NODE["mode"] = NODE_ENV; 

console.log({NODE});

const JWT_SECRET = process.env.JWT_SECRET; // If undefined then we will not use auth token

function NODETribe(tribe) {
  //console.log("NODETribe", tribe);
  // tribe can override NODE 
  if (tribe?.NODE) {
    NODE = utils.deepMerge(NODE, tribe.NODE);
    //console.log("NODETribe merged", NODE);
  }
}

export { DEMO_USER, CACHE_ENABLE, MAP_USER, NODE, JWT_SECRET, NODETribe };
