/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { appLabel as appLabelDefault, appName, appAbbrev } from "./shared/config.mjs"

export { appName, appAbbrev }
export const appLabel = process.env.REACT_APP_LABEL || appLabelDefault; 

const socketProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

let hubUrl = "http://localhost:5001/hub";
if (window.location.hostname !== "localhost") {
    hubUrl = `${window.location.protocol}//${window.location.hostname}/hub`
}
if (process.env.REACT_APP_TASKHUB_URL) {
    hubUrl = `${window.location.protocol}//${process.env.REACT_APP_TASKHUB_URL}`
}

let hubSocketUrl = "ws://localhost:5001/hub/ws"
if (window.location.hostname !== "localhost") {
    hubSocketUrl = `${socketProtocol}//${window.location.hostname}/hub/ws`
}
if (process.env.REACT_APP_TASKHUB_WS) {
    hubSocketUrl = `${socketProtocol}//${process.env.REACT_APP_TASKHUB_WS}`
}

export { hubUrl, hubSocketUrl };