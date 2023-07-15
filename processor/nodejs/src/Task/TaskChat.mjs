/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { SubTaskLLM_async } from "./SubTaskLLM.mjs";
import { fetchTask_async } from "../fetchTask.mjs";
import { cacheStore_async } from "../storage.mjs";

// Task may now be called just because th Task updates and this does not mean for sure that this Task Function should do something

// state === sending : this processor has control

function checkTaskCache (task, T) {
  // Loop over each object in task.config.cache if it exists
  let enabled = false;
  let seed = T("id");
  for (const cacheObj of task.config.cache) {
    if (cacheObj.subTask) {
      continue;
    }
    if (cacheObj.environments && !cacheObj.environments.includes("nodejs")) {
      continue;
    } else {
      console.log("cacheObj.environments", "nodejs");
      enabled = true;
    }
    if (cacheObj.states && !cacheObj.states.includes(task.state.current)) {
      continue;
    } else {
      console.log("cacheObj.states", task.state.current);
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
  return [enabled, seed];
}

const TaskChat_async = async function (taskName, wsSendTask, task) {
  const T = utils.createTaskValueGetter(task);

  console.log(`${taskName} in state ${task.state.current}`);

  // Cache
  const [cacheEnabled, cacheKeySeed] = checkTaskCache(task, T);
  let cachedDiff;
  let origTask = {};
  if (cacheEnabled) {
    // Check if cache exists
    cachedDiff = await cacheStore_async.get(cacheKeySeed);
    if (cachedDiff) {
      console.log("Found cached value for " + cacheKeySeed + " diff " + JSON.stringify(cachedDiff));
      // How do we know what to do with it? Depends on state?
      const mergedTask = utils.deepMerge(task, cachedDiff);
      return mergedTask;
    }
    origTask = JSON.parse(JSON.stringify(task));
  }

  // Could return msgs instead of response.text
  switch (task.state.current) {
    case "mentionAddress":
    case "sending":
      T("state.last", T("state.current"));
      T("state.current", "receiving");
      T("commandArgs.lockBypass", true);
      // Here we update the task which has the effect of setting the state to receiving
      T("command", "update");
      await fetchTask_async(task)
      //console.log("task.output", task.output);
      let msgs = T("input.msgs");
      // Extract the prompt
      //const msgPrompt = msgs[msgs.length - 2];
      //T("state.request.service.prompt", msgPrompt.text)
      T("state.request.service.prompt", T("output.prompt.text"))
      const subTask = await SubTaskLLM_async(wsSendTask, task);
      /*
      const lastElement = {
        ...msgs[msgs.length - 1],
      }; // shallow copy
      lastElement.text = subTask.response.LLM
      // Send to sync latest outputs via Hub, should also unlock
      T("output.msgs", [...msgs.slice(0, -1), lastElement]);
      */
      T("output.promptResponse.text", subTask.response.LLM);
      T("state.last", T("state.current"));
      T("state.current", "received");
      T("commandArgs.unlock", true);
      T("command", "update");
      break;
    default:
      console.log("WARNING unknown state : " + task.state.current);
      return null;
  }

  if (cacheEnabled) {
    // Store in cache
    // We only want to store the changes made to the task
    const diff = utils.getObjectDifference(origTask, task);
    await cacheStore_async.set(cacheKeySeed, diff);
    console.log("Stored in cache " + cacheKeySeed + " diff " + JSON.stringify(diff));
  }

  //T("error", {message: "Testing Error"});

  console.log("Returning from TaskChat_async", task.id);
  return task;
};

export { TaskChat_async };
