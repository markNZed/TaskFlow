/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// .env is intended to allow for config that is not under version control
import { appLabel, appName, appAbbrev, TASKHUB_URL } from "./src/shared/config.mjs"
import path from 'path';
import * as dotenv from "dotenv";
dotenv.config();

const REACT_URL = process.env.REACT_URL || "http://localhost:3000/react";

const NODEJS_URL = process.env.NODEJS_URL || "http://localhost:5000/nodejs"; // A hack until we have config

const CACHE_ENABLE = process.env.CACHE_ENABLE === "true" || true;
console.log("CACHE_ENABLE " + CACHE_ENABLE);

const DEFAULT_USER = "test@testing.com";
// For teting we can map one user to any ohter user e.g.
// MAP_USER_JSON={ "dev@email.com" : "user@email.org" }
let MAP_USER = {};
if (process.env.MAP_USER_JSON) {
  MAP_USER = JSON.parse(process.env.MAP_USER_JSON)
  console.log("MAP_USER ", MAP_USER);
}

const CONFIG_DIR = process.env.CONFIG_DIR || path.resolve("./../processor/nodejs/config-v02/");

console.log("TASKHUB_URL", TASKHUB_URL)

export { REACT_URL, DEFAULT_USER, CACHE_ENABLE, MAP_USER, appLabel, appName, appAbbrev, CONFIG_DIR, TASKHUB_URL };
