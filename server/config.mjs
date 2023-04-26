/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import * as dotenv from 'dotenv'
dotenv.config()

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const DEFAULT_USER = 'test@testing.com'
let DUMMY_OPENAI = false

const CACHE_ENABLE = process.env.CACHE_ENABLE === 'true' || false;
console.log("CACHE_ENABLE " + CACHE_ENABLE)

if (process.env.OPENAI_API_KEY === '') {
    DUMMY_OPENAI = true
}

export { CLIENT_URL, DEFAULT_USER, DUMMY_OPENAI, CACHE_ENABLE, MAP_USER }

