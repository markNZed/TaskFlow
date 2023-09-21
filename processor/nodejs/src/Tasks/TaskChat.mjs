/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { SubTaskLLM_async } from "./SubTaskLLM.mjs";
import { cacheStore_async } from "../storage.mjs";
import { v4 as uuidv4 } from 'uuid';

// Task may now be called just because th Task updates and this does not mean for sure that this Task Function should do something

// state === sending : this processor has control

function checkTaskCache (T) {
  // Loop over each object in T("config.caching") if it exists
  let enabled = false;
  let seed = T("id");
  if (T("config.caching")) {
    for (const cacheObj of T("config.caching")) {
      if (cacheObj.subTask) {
        continue;
      }
      if (cacheObj.environments && !cacheObj.environments.includes("nodejs")) {
        continue;
      } else {
        console.log("cacheObj.environments", "nodejs");
        enabled = true;
      }
      if (cacheObj.states && !cacheObj.states.includes(T("state.current"))) {
        continue;
      } else {
        console.log("cacheObj.states", T("state.current"));
        enabled = true;
      }
      if (enabled && cacheObj.enable === undefined) {
        enabled = true;
      } else if (!cacheObj.enable) {
        continue;
      }
      if (enabled && cacheObj.seed) {
        for (const cacheKeySeed of cacheObj.seed) {
          if (cacheKeySeed.startsWith("task.")) {
            seed += T(cacheKeySeed.slice(5));
          } else {
            seed += cacheKeySeed;
          }
        }
        console.log("cacheObj.seed", seed);
      }
      if (enabled) {
        break;
      }
    }
  }
  return [enabled, seed];
}

// eslint-disable-next-line no-unused-vars
const TaskChat_async = async function (wsSendTask, T, fsmHolder, services) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  // Cache
  const [cacheEnabled, cacheKeySeed] = checkTaskCache(T);
  let cachedDiff;
  let origTask = {};
  if (cacheEnabled) {
    // Check if cache exists
    cachedDiff = await cacheStore_async.get(cacheKeySeed);
    if (cachedDiff) {
      console.log("Found cached value for " + cacheKeySeed + " diff " + JSON.stringify(cachedDiff));
      // How do we know what to do with it? Depends on state?
      const mergedTask = utils.deepMerge(T(), cachedDiff);
      return mergedTask;
    }
    origTask = JSON.parse(JSON.stringify(T()));
  }

  const service = services["chat"].module;

  switch (T("state.current")) {
    case "mentionAddress":
    case "send": { // create code block to avoid linting issue with declaring const in the block
      T("state.current", "receiving");
      T("output.sending", false);
      T("commandArgs.lockBypass", true);
      // Update the task which has the effect of setting the state to receiving on ohter Processors
      T("command", "update");
      wsSendTask(T());
    // We could wait for the hub to synchronize and implement the receiving state
    //case "receiving":
      const subTask = await SubTaskLLM_async(wsSendTask, T(), service);
      T("response.LLMResponse", subTask.response.LLM);
      if (subTask.response.newMessages && subTask.response.newMessages.length) {
        const newMessages = subTask.response.newMessages;
        newMessages.forEach(msg => {
          if (!msg.id) {
            msg["id"] = uuidv4();
          }
          if (msg.function_call) {
            msg["user"] = "assistant";
            try {
              const functionCallObj = msg.function_call;
              msg["content"] = functionCallObj.name + ": " + JSON.stringify(JSON.parse(functionCallObj.arguments));
            } catch (error) {
              console.error("Could not parse function", error);
              msg["content"] = `Could not parse function ${msg.function_call.name}: ${msg.function_call.argumnts}`;
            }
          }
          if (msg.role === "function" && !msg.user) {
            msg["user"] = "function";
          }
        })
        T("response.newMessages", newMessages);
        let msgs = T("output.msgs");
        msgs = [...msgs, ...newMessages];
        T("output.msgs", msgs);
      }
      T("state.current", "received");
      T("commandArgs.lockBypass", true);
      T("command", "update");
      break;
    }
    default:
      console.log("WARNING unknown state : " + T("state.current"));
      return null;
  }

  if (cacheEnabled) {
    // Store in cache
    // We only want to store the changes made to the task
    const diff = utils.getObjectDifference(origTask, T()) || {};
    await cacheStore_async.set(cacheKeySeed, diff);
    console.log("Stored in cache " + cacheKeySeed + " diff " + JSON.stringify(diff));
  }

  //T("error", {message: "Testing Error"});

  return T();
};

export { TaskChat_async };