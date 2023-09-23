/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

export const appLabel = process.env.APP_LABEL || "T@skFlow";
export const appName = process.env.APP_NAME || "T@skFlow";
export const appAbbrev = process.env.APP_ABBREV || "TF";
export const REDIS_URL = process.env.REDIS_URL || "redis://redis-stack-svc:6379";
export const MONGO_URL = process.env.MONGO_URL || "mongodb://user:pass@mongodb:27017/taskflow?authSource=admin";
export const EMPTY_ALL_DB = true;