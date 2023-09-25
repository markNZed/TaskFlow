/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { OperatorLLM_async } from "#operators/OperatorLLM";
import { cacheStore_async } from "../storage.mjs";

// Task may now be called just because th Task updates and this does not mean for sure that this Task Function should do something

// state === send : this processor has control

function checkTaskCache (T) {
  // Loop over each object in T("config.caching") if it exists
  let enabled = false;
  let seed = T("id");
  if (T("config.caching")) {
    for (const cacheObj of T("config.caching")) {
      if (cacheObj.operator) {
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
const TaskSimulateUser_async = async function (wsSendTask, T, fsmHolder, services) {

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

  // Could return msgs instead of response.text
  switch (T("state.current")) {
    case "introduction":
    case "send": {
      const entryState = T("state.current");
      T("state.current", "receiving");
      T("commandArgs.lockBypass", true);
      // Here we update the task which has the effect of setting the state to receiving
      T("command", "update");
      // Could error here. How to chek?
      wsSendTask(T());
      if (entryState === "introduction") {
        const simulationPrompt = { role: "user", text: T("config.local.introductionPrompt"), user: T("user.label") };
        T("output.simulationPrompt", simulationPrompt);
        const simulationResponse = { role: "assistant", text: "", user: "assistant" };
        T("output.simulationResponse", simulationResponse);
        T("request.prompt", T("output.simulationPrompt.text"));
        const operator = await OperatorLLM_async(wsSendTask, T(), services["chat"].module);
        T("output.simulationResponse.text", operator.response.LLM);
      } else {
        let operator = JSON.parse(JSON.stringify(T()));
        const ST = utils.createTaskValueGetter(operator);
        let msgs = ST("output.msgs");
        msgs.shift(); // Remove the first entry
        if (msgs && msgs.length > 0) {
          msgs.forEach(function(item) {
            if (item !== null) {
              if (item.role === "user") {
                item.role = "assistant";
                item.user = "assistant";
              } else if (item.role === "assistant") {
                item.role = "user";
                item.user = T("user.label");
              }
            }
          });
        }
        // The last message in output.msgs should become the prompt
        const simulationPrompt = msgs.pop().text;
        ST("input.msgs", msgs);
        ST("request.prompt", simulationPrompt)
        operator = await OperatorLLM_async(wsSendTask, operator, services["chat"].module);
        const simulationResponse = { role: "assistant", text: operator.response.LLM, user: "assistant" };
        T("output.simulationResponse", simulationResponse);
      }
      // Send to sync latest outputs via Hub, should also unlock
      T("state.current", "received");
      T("commandArgs.unlock", true);
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

  return T();
};

export { TaskSimulateUser_async };
