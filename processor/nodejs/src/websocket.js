/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocket } from "ws";
import { hubSocketUrl, processorId } from "./../config.mjs";
import { register_async, hubId } from "./register.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { do_task_async } from "./doTask.mjs";
import { utils } from "./utils.mjs";

// The reconnection logic should be reworked if an error genrates a close event

let connectionAttempts = 0;
let maxAttempts = 100;
let processorWs;

function wsSendObject(message = {}) {
  if (!processorWs) {
    console.log("Lost websocket for wsSendObject", message);
  } else {
    if (!message?.task) {
      message["task"] = {}
    }
    message.task.destination = hubId;
    message.task.source = processorId;
    if (message.command !== "ping") {
      //console.log("wsSendObject ", JSON.stringify(message) )
      //console.log("wsSendObject " + message.command + " " + message.task.id )
      //console.log("wsSendObject ", message )
    }
    processorWs.send(JSON.stringify(message));
  }
}

const wsSendTask = function (task, command = null) {
  //console.log("wsSendTask " + message)
  let message = {}; 
  message["task"] = task;
  if (command) {
    message["command"] = command;
  }
  wsSendObject(message);
}

const connectWebSocket = () => {
  processorWs = new WebSocket(hubSocketUrl);

  processorWs.onopen = () => {
    console.log("processorWs.onOpen");
    processorWs.data = {};
    processorWs.data["didStart"] = true;
    register_async();
    // reset connection attempts on successful connection
    connectionAttempts = 0;
    const taskPing = () => {
      let currentDateTime = new Date();
      let currentDateTimeString = currentDateTime.toString();
      return {
        updatedeAt: currentDateTimeString,
        destination: "hub",
      }
    }
    wsSendTask(taskPing(), "ping");
    const intervalId = setInterval(() => {
      if (processorWs.readyState === WebSocket.OPEN) {
        wsSendTask(taskPing(), "ping");
      } else {
        clearInterval(intervalId);
      }
    }, 30 * 1000);
    processorWs.pingIntervalId = intervalId;
  }

  processorWs.onmessage = async (e) => {
    if (e.data instanceof Blob) {
      console.log("e.data is a Blob");
      return
    }
    const message = JSON.parse(e.data);
    if (message?.command === "update") {
      // If we receive this task we don't want to send it back to the hub
      // So pass null instead of websocket
      // We do not have a concept of chnages that are in progress like we do in React
      const lastTask = await activeTasksStore_async.get(message.task.instanceId);
      //console.log("lastTask", lastTask?.output?.msgs);
      const mergedTask = utils.deepMerge(lastTask, message.task);
      //console.log("mergedTask", mergedTask?.output?.msgs);
      //console.log("processorWs updating activeTasksStore_async from diff ", mergedTask.id, mergedTask.instanceId)
      if (!mergedTask.id) {
        console.log("processorWs updating activeTasksStore_async lastTask", lastTask)
        console.log("processorWs updating activeTasksStore_async message.task", message.task)
        console.log("processorWs updating activeTasksStore_async mergedTask", mergedTask)
        throw new Error("Problem with merging")
      }
      await activeTasksStore_async.set(message.task.instanceId, mergedTask)
      await do_task_async(wsSendTask, mergedTask)
    } else if (message?.command === "start") {
      console.log("processorWs start activeTasksStore_async", message.task.id, message.task.instanceId)
      await activeTasksStore_async.set(message.task.instanceId, message.task)
      await do_task_async(wsSendTask, message.task)
    } else if (message?.command === "pong") {
      //console.log("ws pong received", message)
    } else if (message?.command === "register") {
      console.log("ws register received", message) 
    } else {
      console.log("Unexpected message", message)
    }
  };

  processorWs.onclose = function (event) {
    console.log("processorWs is closed with code: " + event.code, event.reason);
    // attempt reconnection with backoff on close
    if (processorWs?.data?.didStart) {
      if (connectionAttempts < maxAttempts) {
        //let backoffTime = Math.pow(2, connectionAttempts) * 1000; // Exponential backoff
        let backoffTime = 1000;
        let currentDateTime = new Date();
        let currentDateTimeString = currentDateTime.toString();
        console.log(`Attempting onclose reconnection ${connectionAttempts} in ${backoffTime}ms from ${currentDateTimeString}`);
        setTimeout(connectWebSocket, backoffTime);
        connectionAttempts++;
      } else {
        console.log("Max onclose reconnection attempts reached.");
      }
    }
  };

  processorWs.onerror = function(error) {
    console.error("Websocket error: ", error.message);
    // attempt reconnection with backoff on error
    if (connectionAttempts < maxAttempts) {
      //let backoffTime = Math.pow(2, connectionAttempts) * 1000; // Exponential backoff
      let backoffTime = 5000;
      let currentDateTime = new Date();
      let currentDateTimeString = currentDateTime.toString();
      console.log(`Attempting onerror reconnection ${connectionAttempts} in ${backoffTime}ms from ${currentDateTimeString}`);
      setTimeout(connectWebSocket, backoffTime);
      connectionAttempts++;
    } else {
      console.log("Max onerror reconnection attempts reached.");
    }
  };
}

export { wsSendTask, connectWebSocket };
