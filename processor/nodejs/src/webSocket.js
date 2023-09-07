/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocket } from "ws";
import { hubSocketUrl, processorId } from "../config.mjs";
import { register_async } from "./register.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { taskProcess_async } from "./taskProcess.mjs";
import { utils } from "./utils.mjs";

// The reconnection logic should be reworked if an error genrates a close event

let connectionAttempts = 0;
let maxAttempts = 100;
let processorWs;

function wsSendObject(message) {
  if (!processorWs) {
    console.log("Lost websocket for wsSendObject", message);
  } else {
    if (message.task.processor.command !== "ping") {
      //console.log("wsSendObject ", JSON.stringify(message) )
      //console.log("wsSendObject commmand " + message.task.processor.command + " " + message.task.id + " commandArgs ",message.task.processor.commandArgs)
      //console.log("wsSendObject ", message )
    }
    processorWs.send(JSON.stringify(message));
  }
}

const wsSendTask = async function (task) {
  /*
  if (task.processor.command === "partial") {
    return;
  }
  */
  //console.log("wsSendTask " + message)
  let message = {}; 
  // taskInProcessorOut will return a diff taking into account task.processor.origTask
  task = await utils.taskInProcessorOut_async(task, processorId, activeTasksStore_async);
  task.meta = task.meta || {};
  task.meta.prevMessageId = task.meta.messageId;
  task.meta.messageId = utils.nanoid8();
  message["task"] = task;
  wsSendObject(message);
}

const connectWebSocket = () => {
  processorWs = new WebSocket(hubSocketUrl);

  processorWs.onopen = () => {
    console.log("processorWs.onOpen");
    processorWs.data = {};
    processorWs.data["didStart"] = true;
    // reset connection attempts on successful connection
    connectionAttempts = 0;
    wsSendTask(utils.taskPing());
    const intervalId = setInterval(() => {
      if (processorWs.readyState === WebSocket.OPEN) {
        wsSendTask(utils.taskPing());
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
    //console.log("processorWs.onMessage", message?.task.processor.command);
    let command;
    let commandArgs;
    let task;
    if (message?.task) {
      task = utils.hubInProcessorOut(message.task);
      command = task.processor.command;
      commandArgs = task.processor.commandArgs;
    } else {
      console.error("Missing task in message");
      return;
    }
    if (command !== "pong") {
      console.log("processorWs.onmessage ", command, task.id, commandArgs);
    }
    if (command === "update") {
      const lastTask = await activeTasksStore_async.get(message.task.instanceId);
      //console.log("processorWs.onMessage update", message.task);
      // If we receive this task we don't want to send it back to the hub
      // So pass null instead of websocket
      // We do not have a concept of chnages that are in progress like we do in React
      //console.log("lastTask", lastTask?.output?.msgs);
      const mergedTask = utils.deepMergeProcessor(lastTask, message.task, message.task.processor);
      //console.log("mergedTask", mergedTask?.output?.msgs);
      //console.log("processorWs updating activeTasksStore_async from diff ", mergedTask.id, mergedTask.instanceId)
      console.log("processorWs state:" + mergedTask.state?.current);
      if (!mergedTask.id) {
        throw new Error("Problem with merging")
      }
      // Check hash
      utils.checkHash(lastTask, mergedTask);
      await utils.processorActiveTasksStoreSet_async(activeTasksStore_async, mergedTask);
      if (!commandArgs?.sync) {
        await taskProcess_async(wsSendTask, mergedTask);
      }
    // We should not receive start commands on a Task Processor (unless it is a coprocessor)
    } else if (command === "start") {
      //console.log("Task:", message.task);
      throw new Error("Unexpected start command")
    } else if (command === "join" || command === "init") {
      await utils.processorActiveTasksStoreSet_async(activeTasksStore_async, message.task);
      await taskProcess_async(wsSendTask, message.task)
    } else if (command === "pong") {
      //console.log("ws pong received", message)
    } else if (command === "register") {
      register_async();
    } else if (command === "error") {
      console.log("ws error received but not doing anything yet")
    } else {
      console.log("Unexpected message command ", command)
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
