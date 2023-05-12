/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// .env is intended to allow for config that is not under version control
import * as dotenv from "dotenv";
dotenv.config();

const BROWSER_URL = process.env.BROWSER_URL || "http://localhost:3000";

const CACHE_ENABLE = process.env.CACHE_ENABLE === "true" || true;
console.log("CACHE_ENABLE " + CACHE_ENABLE);

let DUMMY_OPENAI = false;
if (process.env.OPENAI_API_KEY === "") {
  DUMMY_OPENAI = true;
}

const DEFAULT_USER = "test@testing.com";
// For teting we can map one user to any ohter user e.g.
// MAP_USER_JSON={ "dev@email.com" : "user@email.org" }
let MAP_USER = {};
if (process.env.MAP_USER_JSON) {
  MAP_USER = JSON.parse(process.env.MAP_USER_JSON)
  console.log("MAP_USER ", MAP_USER);
}

export { BROWSER_URL, DEFAULT_USER, DUMMY_OPENAI, CACHE_ENABLE, MAP_USER };
