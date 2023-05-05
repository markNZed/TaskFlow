/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

const socketProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

var socketHost = window.location.hostname;
var socketPort = process.env.REACT_APP_WS_LOCALHOST_PORT || 5000;
if (window.location.hostname !== "localhost") {
  socketPort = process.env.REACT_APP_WS_PORT || socketPort;
  socketHost = process.env.REACT_APP_WS_HOST || "localhost";
}

export const socketUrl = `${socketProtocol}//${socketHost}:${socketPort}/ws`;
export const serverUrl =
  window.location.protocol + `//${socketHost}:${socketPort}/`;
export const appLabel = "T@skFlow";
export const appName = "T@skFlow";
export const appAbbrev = "c2f";
