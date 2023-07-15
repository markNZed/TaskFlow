/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocket } from "ws";
import { from, mergeMap, of } from 'rxjs';
import { hubSocketUrl, processorId } from "./../config.mjs";
import { register_async, hubId } from "./register.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { do_task_async } from "./doTask.mjs";
import { utils } from "./utils.mjs";


// The reconnection logic should be reworked if an error genrates a close event

let connectionAttempts = 0;
let maxAttempts = 100;
let processorWs;
let activeTasks = {};

function wsSendObject(message) {
  if (!processorWs) {
    console.log("Lost websocket for wsSendObject", message);
  } else {
    if (!message?.task) {
      throw new Error("Missing task in wsSendObject" + JSON.stringify(message));
    }
    // This is used when sending a partial response from SubTaskLLM.mjs
    if (message.task?.command) {
      message.task.processor.command = message.task.command;
      message.task.command = null;
      if (message.task.commandArgs) {
        // Deep copy because we are going to clear
        message.task.processor.commandArgs = JSON.parse(JSON.stringify(message.task.commandArgs));
        message.task.commandArgs = null;
      }
    }
    message.task.processor["id"] = processorId;
    if (message.task.processor.command !== "ping") {
      //console.log("wsSendObject ", JSON.stringify(message) )
      //console.log("wsSendObject " + message.task.hub.command + " " + message.task.id )
      //console.log("wsSendObject ", message )
    }
    processorWs.send(JSON.stringify(message));
  }
}

const wsSendTask = function (task, command = null) {
  //console.log("wsSendTask " + message)
  let message = {}; 
  message["task"] = task;
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
        processor: {command: "ping"},
      }
    }
    wsSendTask(taskPing());
    const intervalId = setInterval(() => {
      if (processorWs.readyState === WebSocket.OPEN) {
        wsSendTask(taskPing());
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
    if (message?.task) {
      // The processor strips hub specific info because the Task Function should not interact with the Hub
      // Should copy to task.processor.command
      command = message.task.hub.command;
      commandArgs = message.task.hub?.commandArgs;
      delete message.task.hub;
    }
    if (command === "update") {
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
      // Not using activeTasks but if we want Task to interact this will be neccessary
      activeTasks[mergedTask.id] = mergedTask;
      // create an Observable from the promise
      const task$ = from(do_task_async(wsSendTask, mergedTask));
      // use mergeMap operator to handle the async operation
      task$
        .pipe(
          mergeMap(result => {
            // handle the result of the async operation here
            console.log("mergeMap result", result);
            return of(result); // modify this as needed
          })
        )
        .subscribe({
          next: (v) => console.log("subscribe nxt", v),
          error: (e) => console.error(e),
          complete: () => console.info('complete') 
        })
      //await do_task_async(wsSendTask, mergedTask);
      delete activeTasks[mergedTask.id];
    } else if (command === "start" || command === "join") {
      console.log("processorWs " + command + " activeTasksStore_async", message.task.id, message.task.instanceId)
      await activeTasksStore_async.set(message.task.instanceId, message.task)
      await do_task_async(wsSendTask, message.task)
    } else if (command === "pong") {
      //console.log("ws pong received", message)
    } else if (command === "register") {
      console.log("ws register request received")
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
      let backoffTime = 5002;
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
