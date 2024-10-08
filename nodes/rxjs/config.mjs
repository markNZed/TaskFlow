/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// .env is intended to allow for config that is not under version control
import { appLabel, appName, appAbbrev, REDIS_URL, MONGO_URL, EMPTY_ALL_DB } from "./src/shared/config.mjs"
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import * as dotenv from "dotenv";
dotenv.config({ override: true }); // override so we can set OPENAI_API_KEY from .env 
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { utils } from "./src/utils.mjs";

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

let CONFIG_DIR = "../config";
if (process.env.CONFIG_DIR !== undefined) {
  CONFIG_DIR = process.env.CONFIG_DIR;
}

const NODE_NAME = process.env.NODE_NAME || "hub-consumer";

/* 
  NODE
    type: hub, processor, bridge
    role: core, coprocessor, consumer (core can just be ampped to hub/processor/bridge)
    processing: stream, batch (this is interesting geven if we assume N=1 or now)
    environment:
    wsPort:
*/
let NODE;

switch (NODE_NAME) {
  case "hub-consumer":
    NODE = {
      type: "hub",
      role: "consumer",
      processing: ["batch", "stream"],
      environment: "rxjs-hub-consumer",
      // As a Hub node it needs to deal with "start"
      commandsAccepted: ["update", "start", "init", "register", "error", "join", "pong", "reload"],
      wsPort: 5002,
    }
    break;
  case "hub-coprocessor":
    // As a Hub node it needs to deal with "start"
    NODE = {
      type: "hub",
      role: "coprocessor",
      processing: ["stream"],
      environment: "rxjs-hub-coprocessor",
      commandsAccepted: ["update", "start", "init", "register", "error", "join", "reload"],
      wsPort: 5003,
    }
    break;
  case "processor-consumer":
    NODE = {
      type: "processor",
      role: "consumer",
      processing: ["batch"],
      environment: "rxjs-processor-consumer",
      commandsAccepted: ["update", "init", "register", "error", "join", "pong", "reload"],
      wsPort: 5000,
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
NODE["app"] = {
  label: appLabel,
  name: appName,
  abbrev: appAbbrev,
};
NODE["storage"] = {
  redisUrl: REDIS_URL,
  mongoUrl: MONGO_URL,
  emptyAllDB: EMPTY_ALL_DB,
  emptyCache: false,
  mongoMaster: "hub-coprocessor",
  redisMaster: "hub-coprocessor",
  weaviateScheme: 'http',
  weaviateHost: process.env.WEAVIATE_URL || 'weaviate:8080',
  dataDir: "/app/data",
};
NODE["services"] = {
  unstructuredUrl: process.env.UNSTRUCTURED_URL || "http://unstructured:8000/general/v0/general",
}
NODE["id"] = nodeId;
if (process.env.WS_PORT) {
  NODE["wsPort"] = process.env.WS_PORT
}

const NODE_ENV = process.env.NODE_ENV || "production"; //"development"
NODE["mode"] = NODE_ENV; 

console.log({NODE});

function NODETribe(tribe) {
  //console.log("NODETribe", tribe);
  // tribe can override NODE 
  if (tribe?.NODE) {
    NODE = utils.deepMerge(NODE, tribe.NODE);
  }
}

export { CACHE_ENABLE, NODE, DUMMY_OPENAI, TASKHUB_URL, hubSocketUrl, NODETribe };
