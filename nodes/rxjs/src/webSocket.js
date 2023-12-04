/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocket } from "ws";
import { mergeMap, Subject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { hubSocketUrl, NODE, NODETribe } from "../config.mjs";
import { commandRegister_async } from "./commandRegister.mjs";
import { commandReload_async } from "./commandReload.mjs";
import { getActiveTask_async, setActiveTask_async, CEPMatchMap, tribesStore_async } from "./storage.mjs";
import { nodeTasks_async } from "./nodeTasks.mjs";
import { utils } from "./utils.mjs";
import { taskRelease, taskLock } from './shared/taskLock.mjs';

// The reconnection logic should be reworked if an error genrates a close event

let connectionAttempts = 0;
let maxAttempts = 100;
let processorWs;

const taskSubject = new Subject();

// Support regex in the CEP config to match tasks
function findCEP (regexKeys, matchExpr) {
  //console.log("findCEP matchExpr:", matchExpr);
  let result = [];
  const directMatch = CEPMatchMap.get(matchExpr);
  if (directMatch) {
    //console.log("findCEP direct match");
    result.push(directMatch);
  }
  // for each regexKey check if it matches the matchExpr
  //console.log("regexKeys", regexKeys);
  for (const regexKey of regexKeys) {
    // strip "regex:" prefix from regexKey
    const regexStr = regexKey.substring("regex:".length);
    let regex = new RegExp(regexStr);
    let match = regex.test(matchExpr);
    //console.log("regex", regex, matchExpr, match);
    if (match) {
      //console.log("match", CEPMatchMap.get(regexKey));
      result.push(CEPMatchMap.get(regexKey));
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
      utils.logTask(task, "Incoming task command:" + task.node.command + " initiatingNodeId:" + task.node.initiatingNodeId);
      task = utils.nodeToTask(task);
      const taskCopy = utils.deepClone(task); //deep copy
      if (!task.node.coprocessing) {
        utils.removeNullKeys(task);
      }
      utils.debugTask(task, "removeNullKeys");
      // We make an exception for sync so we can log sync that are sent with coprocessed
      const CEPCoprocessor = NODE.role === "coprocessor" && (task.node.coprocessing || task.node?.commandArgs?.sync);
      const processor = NODE.role !== "coprocessor";
      if (CEPMatchMap.size > 0 && (CEPCoprocessor || processor)) {
        // Complex event processing uses a Map of Map
        //  The outer Map matches a task identity of the task that is being processed
        //  The inner Map associates the CEP initiator task.instanceId with a function
        // A task instance can initiate CEP triggered by instanceId, id, familyId
        // Maps maintain order and keys do not need to be strings
        // We always add familyId so CEP can only operate on its own family
        // CEPCreate is how we create the entries
        const CEPFuncsKeys = CEPMatchMap.keys();
        const regexKeys = [...CEPFuncsKeys].filter(key => key.startsWith("regex:"));
        //utils.logTask(task, "CEPMatchMap", CEPMatchMap.keys());
        //utils.logTask(task, "regexKeys", regexKeys);
        //utils.logTask(task, "CEP looking for " + task.familyId + "-instance-" + task.instanceId);
        let instanceIdSourceFuncsMapArray = findCEP(regexKeys, task.familyId + "-instance-" + task.instanceId) || new Map();
        //utils.logTask(task, "CEP instanceIdSourceFuncsMap ", [...instanceIdSourceFuncsMapArray]);
        //utils.logTask(task, "CEP looking for " + task.familyId + "-id-" + task.id);
        let idSourceFuncsMapArray = findCEP(regexKeys, task.familyId + "-id-" + task.id) || new Map();
        //utils.logTask(task, "CEP idSourceFuncsMap ", [...idSourceFuncsMapArray]);
        //utils.logTask(task, "CEP looking for " + task.familyId + "-familyId");
        let familyIdSourceFuncsMapArray = findCEP(regexKeys, task.familyId + "-familyId") || new Map();
        //utils.logTask(task, "CEP familyIdSourceFuncsMap ", [...familyIdSourceFuncsMapArray]);
        let userIdSourceFuncsMapArray = [];
        if (task.user) {
          //utils.logTask(task, "CEP looking for " + task.user.id + "-userId-" + task.id);
          userIdSourceFuncsMapArray = findCEP(regexKeys, task.user.id + "-userId-" + task.id) || new Map();
          //utils.logTask(task, "CEP userIdSourceFuncsMap ", [...userIdSourceFuncsMapArray]);      
        }
        let CEPSecretSourceFuncsMapArray = [];
        if (task.config?.local?.CEPSecret) {
          const CEPsecret = task.config?.local?.CEPSecret;
          //utils.logTask(task, "CEP looking for CEPSecret-" + CEPsecret);
          CEPSecretSourceFuncsMapArray = findCEP(regexKeys, "CEPSecret-" + CEPsecret) || new Map();
          //utils.logTask(task, "CEP CEPSecretSourceFuncsMap ", [...CEPSecretSourceFuncsMapArray]);      
        }
        // Retrieve the function arrays from each Map
        let instanceIdCEPFuncs = []
        for (const instanceIdSourceFuncsMap of instanceIdSourceFuncsMapArray) {
          instanceIdCEPFuncs.push(...instanceIdSourceFuncsMap.values());
        }
        //utils.logTask(task, "CEP instanceIdCEPFuncs", instanceIdCEPFuncs);
        let idCEPFuncs = [];
        for (const idSourceFuncsMap of idSourceFuncsMapArray) {
          idCEPFuncs.push(...idSourceFuncsMap.values());
        }
        let familyIdCEPFuncs = [];
        for (const familyIdSourceFuncsMap of familyIdSourceFuncsMapArray) {
          familyIdCEPFuncs.push(...familyIdSourceFuncsMap.values());
        }  
        let userIdCEPFuncs = [];
        for (const userIdSourceFuncsMap of userIdSourceFuncsMapArray) {
          userIdCEPFuncs.push(...userIdSourceFuncsMap.values());
        }  
        let CEPSecretCEPFuncs = [];
        for (const CEPSecretSourceFuncsMap of CEPSecretSourceFuncsMapArray) {
          CEPSecretCEPFuncs.push(...CEPSecretSourceFuncsMap.values());
        }  
        // Flatten all CEP functions into a single array
        let allCEPFuncs = [...instanceIdCEPFuncs, ...idCEPFuncs, ...familyIdCEPFuncs, ...userIdCEPFuncs, ...CEPSecretCEPFuncs];
        //utils.logTask(task, "allCEPFuncs", allCEPFuncs);
        // Run each CEP function serially
        task.node.CEPExecuted = [];
        // eslint-disable-next-line no-unused-vars
        for (const [CEPInstanceId, func, moduleName, args, filter] of allCEPFuncs) {
          // Here we could have some further filtering to avoid needing to run the function if it is pointless
          // For exmaple if the CEP only supports certain commands or states
          // We could use a generaic task mactch and only proceed if the task has the neccessary fields
          // This needs a new filter filed in allCEPFuncs
          // There may be something to be gained by running this before the regex (although that could be cached eventually)
          // Instead of just building regexKeys we could also extract the filters
          // We have not performed utils.removeNullKeys(task);
          if (CEPCoprocessor) {
            // await so that CEP can modify the task during coprocessing
            // If a Task wants to update itself then it should not use a sync command but return the udpated value
            const CEPSync = task.node?.commandArgs?.sync && task.node?.commandArgs?.CEPSource;
            const CEPSystemLogger = moduleName === "CEPSystemLogger";
            if (CEPSync && !CEPSystemLogger) {
              utils.logTask(task, `Skipping CEP ${moduleName} on sync because CEPSource`);
              continue; // Skip Sync except logging, could have an option for CEP on CEP
            }
            utils.logTask(task, `Running CEP ${moduleName} with args:`, args);
            await func(wsSendTask, CEPInstanceId, task, args);
            task.node.CEPExecuted.push(moduleName);
          } else {
            // We do not await so we do not hang waiting for the lock when a Task sends a sync to itself
            utils.logTask(task, `Running CEP ${moduleName} with args:`, args);
            func(wsSendTask, CEPInstanceId, task, args);
            task.node.CEPExecuted.push(moduleName);
          }
        }
      }
      utils.logTask(task, "after CEP");
      utils.debugTask(task, "after CEP", task?.services?.chat?.API);
      if (NODE.role === "coprocessor") {
        //utils.logTask(task, "taskSubject task.node.coprocessing", task.node.coprocessing, "task.node.coprocessed", task.node.coprocessed);
        if (task.node.coprocessed) {
          utils.logTask(task, "Skipped taskProcess coprocessed:", task.node.coprocessed);
        } else {
          utils.logTask(task, "CoProcessing task");
          await nodeTasks_async(wsSendTask, task, CEPMatchMap);
        }
      } else {
        // Process the task to install the CEP
        //if (task.node.initiatingNodeId !== NODE.id) {
        await nodeTasks_async(wsSendTask, task, CEPMatchMap);
        //}
      }
      if (task.node.coprocessing) {
        return task;
      } else {
        return taskCopy;
      }
    }),
    catchError((error, caught) => {
      console.error('Caught error in taskSubject:', error);
      return caught; // Return the caught observable to continue processing tasks
    })
  )
  .subscribe({
    next: async (task) => {
      if (task === null) {
        utils.logTask(task, "Task processed with null result");
      } else {
        if (NODE.role !== "coprocessor" || task.node.coprocessed) {
          utils.logTask(task, 'Task processed successfully');
          taskRelease(task.instanceId, "Task processed successfully");
        } else {
          // We do not want the coprocessor generating updates before init has finished (for exmaple)
          utils.logTask(task, 'Task processed NODE.role === "coprocessor"', NODE.role === "coprocessor", "task.node.coprocessed", task.node.coprocessed);
        }
      }
    },
    error: (e) => console.error("Subscriber error", e),
    complete: () => console.error("Subscriber complete"),
  });

function wsSendObject(message) {
  if (!processorWs) {
    console.log("Lost websocket for wsSendObject", utils.js(message));
  } else {
    if (message.task.node.command !== "ping") {
      //console.log("wsSendObject ", JSON.stringify(message) )
      //console.log("wsSendObject commmand " + message.task.node.command + " " + message.task.id + " commandArgs ",message.task.node.commandArgs)
      //console.log("wsSendObject ", message )
    }
    processorWs.send(JSON.stringify(message));
  }
}

const wsSendTask = async function (task) {
  //utils.logTask(task, "wsSendTask ", JSON.stringify(task, null, 2));
  let message = {};
  task = await utils.taskToNode_async(task, NODE.id, getActiveTask_async);
  task.meta = task.meta || {};
  if (task.node.initiatingNodeId === NODE.id) {
    task.meta.prevMessageId = task.meta.messageId;
    task.meta.messageId = utils.nanoid8();
    if (task.node.command && task.node.command !== "ping" && task.node.command !== "partial") {
      utils.logTask(task,"New messageId:", task.meta.messageId);
    }
  }
  task["tokens"] = task.tokens || {};
  task.tokens["app"] = NODE.app.token;
  message["task"] = task;
  utils.debugTask(task);
  wsSendObject(message);
}

const connectWebSocket = () => {

  // use a URL encoding because the Hub is expecting that
  const options = {
    headers: {
      'Origin': `http://taskflow`,
    }
  };

  processorWs = new WebSocket(hubSocketUrl, options);

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
    //console.log("processorWs.onMessage", message?.task.node.command);
    let command;
    let commandArgs;
    //console.log("message.task.node", message.task.node);
    let task;
    if (message?.task) {
      task = message.task;
      utils.debugTask(task, "message task");
      command = task.node.command;
      commandArgs = task.node.commandArgs;
      // We do not lock for start because start only arrives once on the coprocessor with task.node.coprocessing 
      // so it does not get released. Start can have instanceId
      // We do not lock for a sync for the same reason - we do not coprocess sync
      // Check for instanceId to avoid locking for commands like register
      // Removed && task.node.initiatingNodeId !== NODE.id because update could happen during init
      // task.node.initiatingNodeId !== NODE.id allows for an update to set the lock and then wait for the
      // hub to send the update (so storage syncs with the hub before sending more updates)
      if (task.instanceId && command !== "start") {
        if (NODE.role !== "coprocessor" || (NODE.role === "coprocessor" && task.node.coprocessing)) {
           if (task.node.initiatingNodeId !== NODE.id || NODE.role === "coprocessor") {
            await taskLock(task.instanceId, "processorWs.onmessage");
           }
        }
      }
      if (task?.tribeId) {
        const tribeId = task.tribeId;
        const tribe = await tribesStore_async.get(tribeId);
        if (tribe) {
          //console.log("Set tribe", tribeId);
          NODETribe(tribe);
        }
      }
    } else {
      console.error("Missing task in message");
      return;
    }
    //utils.logTask(task, "task.node", task.node);
    if (command !== "pong") {
      //utils.logTask(task, "processorWs " + command)
      let msgs = ["processorWs command:", command, "commandArgs:", commandArgs, "commandDescription:", task.node.commandDescription, "state:", task?.state?.current];
      if (NODE.role === "coprocessor") {
        msgs = [...msgs, "coprocessed:", task.node.coprocessed, " coprocessing:", task.node.coprocessing];
      }
      utils.logTask(task, ...msgs);
    }
    if (command === "update") {
      let lastTask = await getActiveTask_async(task.instanceId);
      // A sync can be generated before we have seen the init
      // Maybe when instance is added to the family but has not yet been sent for init
      // Maybe familyStore_async should be updated later
      if (!lastTask) {
        console.error(task, "WARNING: Missing lastTask for update");
        // Need to free up the lock!
        taskRelease(task.instanceId, "Releasing lock because missing lastTask for update");
        return;
        //throw new Error("Missing lastTask for update");
      }
      utils.debugTask(task, "before deepMerge");
      const mergedTask = utils.deepMergeNode(lastTask, task, task.node);
      utils.debugTask(task, "after deepMerge");
      if (!mergedTask.id) {
        throw new Error("Problem with merging, id is missing")
      }
      if (!utils.checkHashDiff(lastTask, mergedTask)) {
        if (mergedTask.node.initiatingNodeId === NODE.id) {
          console.error("Task hash does not match from this node");
        }
      }
      delete mergedTask.node.origTask; // delete so we do not have an old copy in origTask
      mergedTask.node["origTask"] = utils.deepClone(lastTask); // deep copy to avoid self-reference
      if (!mergedTask.node.coprocessing) {
        await utils.nodeActiveTasksStoreSet_async(setActiveTask_async, mergedTask);
      }
      // Emit the mergedTask into the taskSubject
      utils.debugTask(mergedTask, "mergedTask");
      taskSubject.next(mergedTask);
    // Only the coprocessor should receive start (it is transformed into an init on the hub)
    } else if (command === "start" || command === "join" || command === "init") {
      utils.logTask(task, "ws " + command + " id:", task.id, " commandArgs:", task.commandArgs, " state:", task?.state?.current);
      // init should be saved after, in case we generate an update during init ?
      if (!task.node.coprocessing) {
        if (command !== "start") {
          await utils.nodeActiveTasksStoreSet_async(setActiveTask_async, task);
        }
      }
      taskSubject.next(task);
    } else if (command === "error") {
      utils.logTask(task, "ws error id ", task.id, task.instanceId + " familyId:" + task.familyId);
      if (!task.node.coprocessing) {
        await utils.nodeActiveTasksStoreSet_async(setActiveTask_async, task);
      }
      taskSubject.next(task);
    } else if (command === "pong") {
      //utils.logTask(task, "ws pong received", message)
    } else if (command === "register") {
      utils.logTask(task, "ws register request received")
      commandRegister_async(wsSendTask, task);
    } else if (command === "reload") {
      utils.logTask(task, "ws reload request received")
      commandReload_async(wsSendTask, task);
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
        //let currentDateTime = new Date();
        //let currentDateTimeString = currentDateTime.toString();
        //console.log(`Attempting onclose reconnection ${connectionAttempts} in ${backoffTime}ms from ${currentDateTimeString}`);
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
      //let currentDateTime = new Date();
      //let currentDateTimeString = currentDateTime.toString();
      //console.log(`Attempting onerror reconnection ${connectionAttempts} in ${backoffTime}ms from ${currentDateTimeString}`);
      setTimeout(connectWebSocket, backoffTime);
      connectionAttempts++;
    } else {
      console.log("Max onerror reconnection attempts reached.");
    }
  };
}

export { wsSendTask, connectWebSocket };
