/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocket } from "ws";
import { filter, mergeMap, tap, map, Subject } from 'rxjs';
import { hubSocketUrl, processorId, coProcessor } from "../config.mjs";
import { register_async, hubId } from "./register.mjs";
import { activeTasksStore_async } from "./storage.mjs";
import { taskProcess_async } from "./taskProcess.mjs";
import { utils } from "./utils.mjs";
import { releaseResource } from './taskLock.mjs';

// The reconnection logic should be reworked if an error genrates a close event

let connectionAttempts = 0;
let maxAttempts = 100;
let processorWs;

const taskSubject = new Subject();
const CEPFuncs = new Map();

// Support regex in the CEP config to match tasks
function findCEP (CEPFuncsKeys, matchExpr) {
  let result = CEPFuncs.get(matchExpr);
  if (!result) {
    // filter CEPFuncsKeys for those starting with regex:
    const regexKeys = [...CEPFuncsKeys].filter(key => key.startsWith("regex:"));
    // for each regexKey check if it matches the matchExpr
    //utils.logTask(task, "regexKeys", regexKeys)
    for (const regexKey of regexKeys) {
      // strip "regex:" prefix from regexKey
      const regexStr = regexKey.substring("regex:".length);
      let regex = new RegExp(regexStr);
      //console.log("regex", regex);
      let match = regex.test(matchExpr);
      if (match) {
        result = CEPFuncs.get(regexKey);
        break;
      }
    }
  }
  return result;
}

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
      utils.logTask(task, "Incoming task id " + task.id + " command " + task.processor.command);
      const taskCopy = JSON.parse(JSON.stringify(task)); //deep copy
      // Complex event processing uses a Map of Map
      //  The outer Map matches a task identity of the task that is being processed
      //  The inner Map associates the CEP initiator task.instanceId with a function
      // A task instance can initiate CEP triggered by instanceId, id, familyId
      // Maps maintain order and keys do not need to be strings
      // We always add familyId so CEP can only operate on its own family
      // utils.createCEP is how we create the entries
      const CEPFuncsKeys = CEPFuncs.keys();
      //utils.logTask(task, "CEPFuncs", CEPFuncs.keys());
      //utils.logTask(task, "CEP looking for " + task.familyId + "-instance-" + task.instanceId);
      let instanceIdSourceFuncsMap = findCEP(CEPFuncsKeys, task.familyId + "-instance-" + task.instanceId) || new Map();
      //utils.logTask(task, "CEP instanceIdSourceFuncsMap " + [...instanceIdSourceFuncsMap.keys()]);
      //utils.logTask(task, "CEP looking for " + task.familyId + "-id-" + task.id);
      let idSourceFuncsMap = findCEP(CEPFuncsKeys, task.familyId + "-id-" + task.id) || new Map();
      //utils.logTask(task, "CEP idSourceFuncsMap " + [...idSourceFuncsMap.keys()]);
      //utils.logTask(task, "CEP looking for " + task.familyId + "-familyId");
      let familyIdSourceFuncsMap = findCEP(CEPFuncsKeys, task.familyId + "-familyId") || new Map();
      //utils.logTask(task, "CEP familyIdSourceFuncsMap " + [...familyIdSourceFuncsMap.keys()]);      
      // Retrieve the function arrays from each Map
      let instanceIdCEPFuncs = [...instanceIdSourceFuncsMap.values()];
      let idCEPFuncs = [...idSourceFuncsMap.values()];
      let familyIdCEPFuncs = [...familyIdSourceFuncsMap.values()];  
      // Flatten all CEP functions into a single array
      let allCEPFuncs = [...instanceIdCEPFuncs, ...idCEPFuncs, ...familyIdCEPFuncs];
      //utils.logTask(task, "allCEPFuncs", allCEPFuncs);
      // Run each CEP function serially
      for (const [CEPInstanceId, func, functionName, args] of allCEPFuncs) {
        utils.logTask(task, `Running CEP function ${functionName} with args:`, args);
        await func(functionName, wsSendTask, CEPInstanceId, task, args);
      }
      // Check for changes to the task
      const diff = utils.getObjectDifference(taskCopy, task) || {};
      if (Object.keys(diff).length > 0) {
        utils.logTask(task, "DIFF", diff);
      } else {
        utils.logTask(task, "no DIFF", taskCopy?.state?.current, task?.state?.current);
      }
      if (coProcessor) {
        utils.logTask(task, "CoProcessing task " + taskCopy.id);
        //utils.logTask(task, "taskSubject taskCopy.processor.coProcessing", taskCopy.processor.coProcessing, "taskCopy.processor.coProcessingDone", taskCopy.processor.coProcessingDone);
        if (task.processor.initiatingProcessorId !== processorId && !task.processor.coProcessingDone) {
          task = await taskProcess_async(wsSendTask, task, CEPFuncs);
        } else {
          utils.logTask(task, "Skipped taskProcess")
        }
        /*
        if (task.processor.command === "update") {
          utils.logTask(task, "CoProcessing task.state ", task?.state.current);
          const diff = utils.getObjectDifference(taskCopy, task) || {};
          if (Object.keys(task).length > 0 && Object.keys(diff).length > 0) {
            utils.logTask(task, "CoProcessing diff ", diff);
            //await commandUpdate_async(wsSendTask, task, diff, true);
          }
        }
        */
        //wsSendTask(task);
        //utils.logTask(task, "CoProcessing task ", task);
      } else {
        /*
        if (Object.keys(diff).length > 0) {
          utils.logTask(task, "DIFF", diff);
          await commandUpdate_async(wsSendTask, task, diff, true);
        }
        */
        // Process the task to install the CEP
        if (task.processor.initiatingProcessorId !== processorId) {
          task = await taskProcess_async(wsSendTask, task, CEPFuncs);
        }
      }
      return taskCopy;
    }),
  )
  .subscribe({
    next: async (task) => {
      if (task === null) {
        utils.logTask(task, "Task processed with null result");
      } else {
        if (!coProcessor || task.processor.coProcessingDone) {
          await utils.processorActiveTasksStoreSet_async(activeTasksStore_async, task);
          releaseResource(task.instanceId);
          utils.logTask(task, 'Task processed successfully');
        }
      }
    },
    error: (e) => console.error(e),
    complete: () => console.info('complete'),
  });

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
  //utils.logTask(task, "wsSendTask ");
  let message = {};
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
    register_async();
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
    //console.log("message.task.hub", message.task.hub);
    let task;
    if (message?.task) {
      task = utils.hubInProcessorOut(message.task);
      command = task.processor.command;
      commandArgs = task.processor.commandArgs;
    } else {
      console.error("Missing task in message");
      return;
    }
    //utils.logTask(task, "task.processor", task.processor);
    if (command !== "pong") {
      //utils.logTask(task, "processorWs " + command)
      utils.logTask(task, "processorWs coProcessingDone " + task.processor.coProcessingDone + " coProcessing " + task.processor.coProcessing);
    }
    if (command === "update") {
      const lastTask = await activeTasksStore_async.get(task.instanceId);
      const mergedTask = utils.deepMergeProcessor(lastTask, task, task.processor);
      if (!mergedTask.id) {
        throw new Error("Problem with merging, id is missing")
      }
      utils.logTask(task, "ws " + command + " commandArgs:", commandArgs, " state:" + mergedTask.state?.current + " id:" + mergedTask.id + " instanceId:" + mergedTask.instanceId);
      // The sync arrives after activeTasksStore_async has been updated so hash mismatch?
      // Check hash 
      if (!utils.checkHash(lastTask, mergedTask)) {
        if (mergedTask.processor.initiatingProcessorId === processorId) {
          console.error("Task hash does not match from this processor");
        }
      }
      //utils.logTask(task, "processorWs updating activeTasksStore_async processor", mergedTask.processor);
      //utils.logTask(task, "processorWs updating activeTasksStore_async meta", mergedTask.meta);
      // Emit the mergedTask into the taskSubject
      if (coProcessor) {
        delete mergedTask.processor.origTask; // delete so we do not have an old copy in origTask
        mergedTask.processor["origTask"] = JSON.parse(JSON.stringify(lastTask)); // deep copy to avoid self-reference      
        taskSubject.next(mergedTask);
      } else {
        delete mergedTask.processor.origTask; // delete so we do not have an old copy in origTask
        mergedTask.processor["origTask"] = JSON.parse(JSON.stringify(lastTask)); // deep copy to avoid self-reference      
        taskSubject.next(mergedTask);
      }
    } else if (command === "start" || command === "join" || command === "init") {
      utils.logTask(task, "ws " + command + " id:", task.id, " commandArgs:",task.commandArgs);
      // Emit the task into the taskSubject
      if (coProcessor) {
        taskSubject.next(task);
      } else {
        // To stop looping if we start a task from this processor
        taskSubject.next(task);
      }
    } else if (command === "error") {
      utils.logTask(task, "ws " + command + " id ", task.id, task.instanceId + " familyId:" + task.familyId);
      // Emit the task into the taskSubject
      if (coProcessor) {
        taskSubject.next(task);
      } else {
        // To stop looping if we start a task from this processor
        taskSubject.next(task);
      }
    } else if (command === "pong") {
      //utils.logTask(task, "ws pong received", message)
    } else if (command === "register") {
      utils.logTask(task, "ws register request received")
      register_async();
    } else if (command === "error") {
      utils.logTask(task, "ws error received but not doing anything yet")
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
