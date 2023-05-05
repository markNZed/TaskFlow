/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "./utils.mjs";
import {} from "../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();

var connections = new Map(); // Stores WebSocket instances with unique session IDs

// Each keyv store is in a different table
const DB_URI = "sqlite://db/main.sqlite";

// We could have one keyv store and use prefix for different tables

// Schema: See ChatGPTAPI
// For now this is a dedicated store but eventually it
// should be an interface to the threads + instances
const messagesStore_async = utils.newKeyV(DB_URI, "messages");
// Schema:
//   Key: sessionId || sessionId + 'userId'
//   Value: object
const sessionsStore_async = utils.newKeyV(DB_URI, "sessions");
// Schema:
//   Key: hash
//   Value: object
const cacheStore_async = utils.newKeyV(DB_URI, "cache");
// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = utils.newKeyV(DB_URI, "instances");
// Schema:
//   Key: threadId || taskId + userId || taskId + sessionId || taskId + groupId
//   Value: array of instanceId
const threadsStore_async = utils.newKeyV(DB_URI, "threads");

export {
  messagesStore_async,
  sessionsStore_async,
  cacheStore_async,
  instancesStore_async,
  threadsStore_async,
  connections,
};
