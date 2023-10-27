/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { appLabel as appLabelDefault, appName, appAbbrev, TOKEN_APP as TOKEN_APP_DEFAULT } from "./shared/config.mjs";

const appLabel = process.env.REACT_APP_APP_LABEL || appLabelDefault;
const TOKEN_APP = process.env.REACT_APP_TOKEN_APP || TOKEN_APP_DEFAULT;

// Define protocol and hostname based on the environment
let protocol, hostname;
if (typeof window !== 'undefined') {
  // Browser environment
  protocol = window.location.protocol;
  hostname = window.location.hostname;
} else {
  // Node.js environment
  protocol = process.env.PROTOCOL || 'http:';
  hostname = process.env.HOSTNAME || 'localhost';
}

const socketProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

let hubUrl = 'http://localhost:5001/hub';
if (hostname !== 'localhost') {
  hubUrl = `${protocol}//${hostname}/hub`;
}
if (process.env.REACT_APP_TASKHUB_URL) {
  hubUrl = `${protocol}//${process.env.REACT_APP_TASKHUB_URL}`;
}

let hubSocketUrl = 'ws://localhost:5001/hub/ws';
if (hostname !== 'localhost') {
  hubSocketUrl = `${socketProtocol}//${hostname}/hub/ws`;
}
if (process.env.REACT_APP_TASKHUB_WS) {
  hubSocketUrl = `${socketProtocol}//${process.env.REACT_APP_TASKHUB_WS}`;
}

export {
  appName,
  appAbbrev,
  appLabel,
  hubUrl,
  hubSocketUrl,
  TOKEN_APP,
};