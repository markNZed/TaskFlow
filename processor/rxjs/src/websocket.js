/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocket } from "ws";
import { filter, mergeMap, tap, map, Subject } from 'rxjs';
import { hubSocketUrl, processorId, coProcessor } from "./../config.mjs";
import { register_async, hubId } from "./register.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { taskUpdate_async } from "./taskUpdate.mjs";
import { utils } from "./utils.mjs";
import { commandUpdateSync_async } from "./commandUpdateSync.mjs";

// The reconnection logic should be reworked if an error genrates a close event

let connectionAttempts = 0;
let maxAttempts = 100;
let processorWs;

const taskSubject = new Subject();
const CEPFuncs = new Map();

// We will need to track activeTasks to remove CEP and cleanup unused CEPfunc
// Maybe detect when family has no active tasks
taskSubject
  .pipe(
    /*
    filter((task) => {
      return true; // Return false to filter out tasks
    }),
    */
    mergeMap(async (task) => {
      console.log("Incoming task", task.id);
      const taskCopy = JSON.parse(JSON.stringify(task)); //deep copy
      // Complex event processing uses a Map of Map
      //  The outer Map matches a task identity of the task that is being processed
      //  The inner Map associates the CEP initiator task.instanceId with a function
      // A task instance can initiate CEP triggered by instanceId, id, familyId
      // Maps maintain order and keys do not need to be strings
      // We always add familyId so CEP can only operate on its own family
      let instanceSourceFuncsMap = CEPFuncs.get(task.instanceId + task.familyId) || new Map();
      let taskSourceFuncsMap = CEPFuncs.get(task.id + task.familyId) || new Map();
      let familySourceFuncsMap = CEPFuncs.get(task.familyId + task.familyId) || new Map();    
      // Retrieve the function arrays from each Map
      let instanceCEPFuncs = [...instanceSourceFuncsMap.values()];
      let taskCEPFuncs = [...taskSourceFuncsMap.values()];
      let familyCEPFuncs = [...familySourceFuncsMap.values()];  
      // Flatten all CEP functions into a single array
      let allCEPFuncs = [...instanceCEPFuncs, ...taskCEPFuncs, ...familyCEPFuncs];
      //console.log("allCEPFuncs", allCEPFuncs);
      // Run each CEP function serially
      for (const [origTask, func, functionName, args] of allCEPFuncs) {
        console.log(`Running CEP function ${functionName} with ${args}`);
        await func(functionName, wsSendTask, origTask, task, args);
      }
      // Check for changes to the task
      const diff = utils.getObjectDifference(taskCopy, task);
      //if (Object.keys(diff).length > 0) {
      //  console.log("DIFF", diff);
      //}
      if (coProcessor) {
        console.log("CoProcessing task " + taskCopy.id);
        //console.log("taskSubject task.processor.coProcessing", task.processor.coProcessing, "task.processor.coProcessingDone", task.processor.coProcessingDone);
        //console.log("taskSubject taskCopy.processor.coProcessing", taskCopy.processor.coProcessing, "taskCopy.processor.coProcessingDone", taskCopy.processor.coProcessingDone);
        task = await taskUpdate_async(wsSendTask, task, CEPFuncs);
        //console.log("CoProcessing task ", task);
      } else {
        // We assume that any sync commands are run from the CEP function
        if (task.processor["command"] === "update" || task.processor["command"] === "start") {
          await taskUpdate_async(wsSendTask, taskCopy, CEPFuncs);
        }
        if (Object.keys(diff).length > 0) {
          console.log("DIFF", diff);
          await commandUpdateSync_async(wsSendTask, taskCopy, diff);
        }
      }
      return task;
    }),
  )
  .subscribe({
    next: (result) => {
      if (result === null) {
        console.log("Task processed with null result");
      } else if (result.error) {
        console.error('Error processing task:', result.error);
      } else {
        console.log('Task processed successfully');
      }
    },
    error: (e) => console.error(e),
    complete: () => console.info('complete'),
  });


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
      //console.log("wsSendObject commmand " + message.task.processor.command + " " + message.task.id + " commandArgs ",message.task.processor.commandArgs)
      //console.log("wsSendObject ", message )
    }
    processorWs.send(JSON.stringify(message));
  }
}

const wsSendTask = function (task) {
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
    //console.log("message.task.hub", message.task.hub);
    let task;
    if (message?.task) {
      task = message.task;
      const hub = JSON.parse(JSON.stringify(task.hub)); // deep copy
      delete task.hub;
      // The processor strips hub specific info because the Task Function should not interact with the Hub
      command = hub.command;
      commandArgs = hub?.commandArgs;
      delete hub.id;
      task.processor = task.processor || {};
      task.processor["command"] = command;
      task.processor["commandArgs"] = commandArgs;
      task.processor = utils.deepMerge(task.processor, hub);
    } else {
      console.error("Missing task in message");
      return;
    }
    //console.log("task.processor", task.processor);
    if (command !== "pong") {
      console.log(""); //empty line
      //console.log("processorWs " + command)
      console.log("processorWs coProcessingDone " + task.processor.coProcessingDone + " coProcessing " + task.processor.coProcessing);
    }
    if (command === "update") {
      const lastTask = await activeTasksStore_async.get(task.instanceId);
      const mergedTask = utils.deepMergeProcessor(lastTask, task, task.processor);
      // Because deepMergeProcessor would replace hashTask we need to run this after deepMergeProcessor
      mergedTask.processor["hashTask"] = JSON.parse(JSON.stringify(lastTask)); // deep copy to avoid self-reference
      if (!mergedTask.id) {
        throw new Error("Problem with merging, id is missing")
      }
      console.log("ws " + command + " commandArgs:", commandArgs, " state:" + mergedTask.state?.current + " id:" + mergedTask.id + " instanceId:" + mergedTask.instanceId);
      // Check hash
      const hash = lastTask.meta.hash;
      if (hash !== mergedTask.meta.hash) {
        console.error("ERROR: Task hash does not match", task.processor.sourceProcessorId, hash, mergedTask.meta.hash);
      }
      //console.log("processorWs updating activeTasksStore_async processor", mergedTask.processor);
      //console.log("processorWs updating activeTasksStore_async meta", mergedTask.meta);
      // Emit the mergedTask into the taskSubject
      if (mergedTask.processor.initiatingProcessorId !== processorId && !commandArgs.sync && !mergedTask.processor.coProcessingDone) {
        console.log("processorWs mergedTask.processor.coProcessing", mergedTask.processor.coProcessing, "mergedTask.processor.coProcessingDone", mergedTask.processor.coProcessingDone);
        taskSubject.next(mergedTask);
      } else {
        // Here we are receiving an update not coprocessing so we store the task.
        // The stored task needs to be in sync with the hub if we want to use diffs
        mergedTask.meta["hash"] = utils.taskHash(mergedTask);
        delete mergedTask.processor.hashTask;
        await activeTasksStore_async.set(mergedTask.instanceId, mergedTask)
        console.log("Skip update initiatingProcessorId", task.processor.initiatingProcessorId, "processorId", processorId, "sync", commandArgs.sync, "coProcessingDone", task.processor.coProcessingDone);
      }
    } else if (command === "start" || command === "join") {
      console.log("ws " + command + " id ", task.id, task.instanceId)
      // Emit the task into the taskSubject
      if (task.processor.sourceProcessorId !== processorId && !task.processor.coProcessingDone) {
        taskSubject.next(task);
      } else {
        delete task.processor.hashTask;
        await activeTasksStore_async.set(task.instanceId, task)
        console.log("Skip ", command, task.processor.sourceProcessorId, "processorId", processorId, "coProcessingDone", task.processor.coProcessingDone);
      }
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
