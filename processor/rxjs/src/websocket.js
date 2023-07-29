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
import { do_task_async } from "./doTask.mjs";
import { utils } from "./utils.mjs";
import { updateSyncCommand_async } from "./updateSyncCommand.mjs";
import { coProcessTask_async } from "./coProcessTask.mjs";

// The reconnection logic should be reworked if an error genrates a close event

let connectionAttempts = 0;
let maxAttempts = 100;
let processorWs;

const taskSubject = new Subject();
const CEPFuncs = new Map();

// We will need to track activeTasks to remove CEP and cleanup unused CEPfunc
// Maybe dedect when family has no active tasks
taskSubject
  .pipe(
    filter((task) => {
      return true;
      // Filter out some tasks.
      // Return false to filter out
      if (task.id === "root.conversation.chatgptzeroshot") {
        console.log("Filtering out root.conversation.chatgptzeroshot");
        return false;
      } else {
        return true;
      }
    }),
    mergeMap(async (task) => {
      // Insert additional side-effects or logging here.
      console.log("Incoming task", task.id);
      const origTask = JSON.parse(JSON.stringify(task)); //deep copy
      // Not sure we need to delete here, processor should have cleaned this up?
      delete task.command;
      delete task.commandArgs;
      // Complex event processing uss a Map of Map
      // The outer Map matches a task property with a Map of functions
      // The inner Map matches a source task.instanceId with a function
      // This allows us to have each instance set CEP triggered by instanceId, id, familyId
      // Maps maintian their order and keys do not need to be strings
      // We add familyId so CEP can only operate on its own family
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
      //allCEPFuncs.forEach(([func, args]) => func(task, args));
      // Run each CEP function one after another
      for (const [func, functionName, args] of allCEPFuncs) {
        console.log(`Running CEP function ${functionName} with ${args}`);
        await func(task, args);
      }
      // Check for changes to the task
      const diff = utils.getObjectDifference(origTask, task);
      if (coProcessor) {
        console.log("CoProcessing task " + origTask.id);
        task = await coProcessTask_async(wsSendTask, task, CEPFuncs);
        //console.log("CoProcessing task ", task);
      } else {
        // We assume that any sync commands are run from the CEP function
        if (task.processor["command"] === "update" || task.processor["command"] === "start") {
          await do_task_async(wsSendTask, origTask, CEPFuncs);
        }
        if (Object.keys(diff).length > 0) {
          console.log("DIFF", diff);
          await updateSyncCommand_async(wsSendTask, origTask, diff);
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
    let coProcessorPosition; 
    let sourceProcessorId;
    let initiatingProcessorId;
    let coProcessing;
    let coProcessingDone;
    //console.log("message.task.hub", message.task.hub);
    if (message?.task) {
      // The processor strips hub specific info because the Task Function should not interact with the Hub
      command = message.task.hub.command;
      commandArgs = message.task.hub?.commandArgs;
      coProcessorPosition = message.task.hub?.coProcessorPosition;
      sourceProcessorId = message.task.hub?.sourceProcessorId;
      initiatingProcessorId = message.task.hub?.initiatingProcessorId;
      coProcessingDone = message.task.hub?.coProcessingDone;
      coProcessing = message.task.hub?.coProcessing;
      delete message.task.hub;
      message.task.processor = message.task.processor || {};
      message.task.processor["command"] = command;
      message.task.processor["commandArgs"] = commandArgs;
      message.task.processor["coProcessorPosition"] = coProcessorPosition;
      message.task.processor["sourceProcessorId"] = sourceProcessorId;
      message.task.processor["initiatingProcessorId"] = initiatingProcessorId;
      message.task.processor["coProcessing"] = coProcessing;
      message.task.processor["coProcessingDone"] = coProcessingDone;
    }
    //console.log("message.task.processor", message.task.processor);
    if (command !== "pong") {
      console.log(""); //empty line
      //console.log("processorWs " + command)
      console.log("processorWs coProcessingDone " + message.task.processor.coProcessingDone + " coProcessing " + message.task.processor.coProcessing);
    }
    if (command === "update") {
      const lastTask = await activeTasksStore_async.get(message.task.instanceId);
      //const diff = utils.getObjectDifference(lastTask, message.task); 
      //console.log("diff", diff, message.task.meta);
      // If we receive this task we don't want to send it back to the hub
      // So pass null instead of websocket
      // We do not have a concept of chnages that are in progress like we do in React
      //console.log("lastTask", lastTask?.output?.msgs);
      const mergedTask = utils.deepMergeProcessor(lastTask, message.task, message.task.processor);
      //console.log("mergedTask", mergedTask?.output?.msgs);
      //console.log("processorWs updating activeTasksStore_async from diff ", mergedTask.id, mergedTask.instanceId)
      if (!mergedTask.id) {
        throw new Error("Problem with merging")
      }
      console.log("ws " + command + " activeTasksStore_async " + mergedTask.id + " " + mergedTask.instanceId);
      // Check hash
      const hash = utils.taskHash(mergedTask);
      if (hash !== mergedTask.meta.hash) {
        console.error("ERROR: Task hash does not match", mergedTask.meta.broadcastCount, hash, mergedTask.meta.hash);
      }
      await activeTasksStore_async.set(mergedTask.instanceId, mergedTask)
      //console.log("processorWs updating activeTasksStore_async processor", mergedTask.processor);
      //console.log("processorWs updating activeTasksStore_async meta", mergedTask.meta);
      // Emit the mergedTask into the taskSubject
      if (message.task.processor.initiatingProcessorId !== processorId && !commandArgs.sync && !message.task.processor.coProcessingDone) {
        taskSubject.next(mergedTask);
      } else {
        console.log("Skip update initiatingProcessorId", message.task.processor.initiatingProcessorId, "processorId", processorId, "sync", commandArgs.sync, "coProcessingDone", message.task.processor.coProcessingDone);
      }
    } else if (command === "start" || command === "join") {
      console.log("ws " + command + " activeTasksStore_async", message.task.id, message.task.instanceId)
      await activeTasksStore_async.set(message.task.instanceId, message.task)
      // Emit the task into the taskSubject
      if (message.task.processor.sourceProcessorId !== processorId && !message.task.processor.coProcessingDone) {
        taskSubject.next(message.task);
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
