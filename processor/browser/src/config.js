/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { appLabel as appLabelDefault, appName, appAbbrev, TASKHUB_URL } from "./shared/config.mjs"

export { appName, appAbbrev }
export const appLabel = process.env.REACT_APP_LABEL || appLabelDefault; 
export const taskhubUrl = process.env.REACT_APP_TASKHUB_URL || TASKHUB_URL;
//console.log("taskhubUrl", taskhubUrl);

const socketProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

export const socketUrl = `${socketProtocol}//${window.location.hostname}/nodejs/ws`;
export const nodejsUrl = window.location.protocol + "//" + (process.env.REACT_APP_NODEJS_HOST || "localhost:5000") + `/nodejs`;
//console.log("nodejsUrl", nodejsUrl);
//console.log("window.location.protocol", window.location.protocol)
