/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocket } from "ws";
import { mergeMap, Subject } from 'rxjs';
import { hubSocketUrl, NODE } from "../config.mjs";
import { register_async } from "./register.mjs";
import { getActiveTask_async, setActiveTask_async } from "./storage.mjs";
import { taskProcess_async } from "./taskProcess.mjs";
import { utils } from "./utils.mjs";
import { taskRelease, taskLock } from './shared/taskLock.mjs';

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
      utils.logTask(task, "Incoming task command:" + task.processor.command + " initiatingProcessorId:" + task.processor.initiatingProcessorId);
      task = utils.processorInTaskOut(task);
      const taskCopy = JSON.parse(JSON.stringify(task)); //deep copy
      if (!task.processor.coprocessing) {
        utils.removeNullKeys(task);
      }
      // We make an exception for sync so we can log sync taht are sent with coprocessingDone
      const CEPCoprocessor = NODE.role === "coprocessor" && (task.processor.coprocessing || task.processor?.commandArgs?.sync);
      const CEPprocessor = NODE.role !== "coprocessor";
      if (CEPCoprocessor || CEPprocessor ) {
        // Complex event processing uses a Map of Map
        //  The outer Map matches a task identity of the task that is being processed
        //  The inner Map associates the CEP initiator task.instanceId with a function
        // A task instance can initiate CEP triggered by instanceId, id, familyId
        // Maps maintain order and keys do not need to be strings
        // We always add familyId so CEP can only operate on its own family
        // utils.createCEP is how we create the entries
        const CEPFuncsKeys = CEPFuncs.keys();
        //utils.logTask(task, "CEPFuncs", CEPFuncs.keys());
        //utils.logTask(task, "CEPFuncs", CEPFuncs);
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
        //utils.logTask(task, "CEP instanceIdCEPFuncs", instanceIdCEPFuncs);
        let idCEPFuncs = [...idSourceFuncsMap.values()];
        let familyIdCEPFuncs = [...familyIdSourceFuncsMap.values()];  
        // Flatten all CEP functions into a single array
        let allCEPFuncs = [...instanceIdCEPFuncs, ...idCEPFuncs, ...familyIdCEPFuncs];
        //utils.logTask(task, "allCEPFuncs", allCEPFuncs);
        // Run each CEP function serially
        task.processor.CEPExecuted = [];
        for (const [CEPInstanceId, func, functionName, args] of allCEPFuncs) {
          utils.logTask(task, `Running CEP function ${functionName} with args:`, args);
          // We have not performed utils.removeNullKeys(task);
          // await so that CEP can modify the task during coprocessing
          await func(functionName, wsSendTask, CEPInstanceId, task, args);
          task.processor.CEPExecuted.push(functionName);
        }
      }
      if (NODE.role === "coprocessor") {
        //utils.logTask(task, "taskSubject task.processor.coprocessing", task.processor.coprocessing, "task.processor.coprocessingDone", task.processor.coprocessingDone);
        if (task.processor.coprocessingDone) {
          utils.logTask(task, "Skipped taskProcess coprocessingDone:", task.processor.coprocessingDone);
        } else {
          utils.logTask(task, "CoProcessing task");
          await taskProcess_async(wsSendTask, task, CEPFuncs);
        }
      } else {
        // Process the task to install the CEP
        if (task.processor.initiatingProcessorId !== NODE.id) {
          await taskProcess_async(wsSendTask, task, CEPFuncs);
        }
      }
      if (task.processor.coprocessing) {
        return task;
      } else {
        return taskCopy;
      }
    }),
  )
  .subscribe({
    next: async (task) => {
      if (task === null) {
        utils.logTask(task, "Task processed with null result");
      } else {
        if (NODE.role !== "coprocessor" || task.processor.coprocessingDone) {
          utils.logTask(task, 'Task processed successfully');
          taskRelease(task.instanceId, "Task processed successfully");
        } else {
          utils.logTask(task, 'Task processed NODE.role === "coprocessor"', NODE.role === "coprocessor", "task.processor.coprocessingDone", task.processor.coprocessingDone);
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
  //utils.logTask(task, "wsSendTask ", JSON.stringify(task, null, 2));
  let message = {};
  task = await utils.taskInProcessorOut_async(task, NODE.id, getActiveTask_async);
  task.meta = task.meta || {};
  if (NODE.role !== "coprocessor") {
    task.meta.prevMessageId = task.meta.messageId;
    task.meta.messageId = utils.nanoid8();
  }
  message["task"] = task;
  //console.log("wsSendTask state:", task?.state?.current)
  utils.debugTask(task);
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
    //console.log("message.task.hub", message.task.hub);
    let task;
    if (message?.task) {
      task = utils.hubInProcessorOut(message.task);
      task.processor["isCoprocessor"] = NODE.role === "coprocessor";
      command = task.processor.command;
      commandArgs = task.processor.commandArgs;
      // We do not lock for start because start only arrives once on the coprocessor with task.processor.coprocessing 
      // so it does not get released. Start can have instanceId
      // We do not lock for a sync for the same reason - we do not coprocess sync
      // Check for instanceId to avoid locking for commands like register
      if (task.instanceId && command !== "start" && task.processor.initiatingProcessorId !== NODE.id) {
        if (NODE.role !== "coprocessor" || (NODE.role === "coprocessor" && task.processor.coprocessing)) {
           await taskLock(task.instanceId, "processorWs.onmessage");
        }
      }
     } else {
      console.error("Missing task in message");
      return;
    }
    //utils.logTask(task, "task.processor", task.processor);
    if (command !== "pong") {
      //utils.logTask(task, "processorWs " + command)
      utils.logTask(task, "processorWs coprocessingDone:" + task.processor.coprocessingDone + " coprocessing:" + task.processor.coprocessing);
    }
    if (command === "update") {
      let lastTask = await getActiveTask_async(task.instanceId);
      // If coprocessor then we are getting lastTask from the Hub.
      // A hack is to "convert" the hub task into a processor task
      if (!lastTask) {
        utils.logTask(task,"Missing lastTask for update");
        throw new Error("Missing lastTask for update");
      }
      const mergedTask = utils.deepMergeProcessor(lastTask, task, task.processor);
      if (!mergedTask.id) {
        throw new Error("Problem with merging, id is missing")
      }
      utils.logTask(task, "ws " + command + " commandArgs:", commandArgs, " state:" + mergedTask.state?.current + " id:" + mergedTask.id + " instanceId:" + mergedTask.instanceId);
      if (!utils.checkHashDiff(lastTask, mergedTask)) {
        if (mergedTask.processor.initiatingProcessorId === NODE.id) {
          console.error("Task hash does not match from this processor");
        }
      }
      delete mergedTask.processor.origTask; // delete so we do not have an old copy in origTask
      mergedTask.processor["origTask"] = JSON.parse(JSON.stringify(lastTask)); // deep copy to avoid self-reference
      if (!mergedTask.processor.coprocessing) {
        await utils.processorActiveTasksStoreSet_async(setActiveTask_async, mergedTask);
      }
      // Emit the mergedTask into the taskSubject
      taskSubject.next(mergedTask);
    // Only the coprocessor should receive start (it is transformed into an init on the hub)
    } else if (command === "start" || command === "join" || command === "init") {
      utils.logTask(task, "ws " + command + " id:", task.id, " commandArgs:", task.commandArgs, " state:", task?.state?.current);
      if (!task.processor.coprocessing) {
        if (command !== "start") {
          task = await utils.processorActiveTasksStoreSet_async(setActiveTask_async, task);
        }
      }
      taskSubject.next(task);
    } else if (command === "error") {
      utils.logTask(task, "ws " + command + " id ", task.id, task.instanceId + " familyId:" + task.familyId);
      if (!task.processor.coprocessing) {
        await utils.processorActiveTasksStoreSet_async(setActiveTask_async, task);
      }
      taskSubject.next(task);
    } else if (command === "pong") {
      //utils.logTask(task, "ws pong received", message)
    } else if (command === "register") {
      utils.logTask(task, "ws register request received")
      register_async();
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
