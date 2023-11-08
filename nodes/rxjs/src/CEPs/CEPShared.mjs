/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/*
  CEP that will look after task.shared
    Detect when shared has changed
    Maintain a list of Tasks that must be updated
    During init set thee content of task.shared
    Organise by familyId 
    If there is no familyId then match all familyIds
*/
import { utils } from "#src/utils";
import { sharedStore_async } from "#src/storage";
import { commandUpdate_async } from "#src/commandUpdate";
// eslint-disable-next-line no-unused-vars
import assert from 'assert';

// Could have a familyId of system that works for system variables?
// But this can be different per user etc
// The raw data is the same but not what is attached to the task

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {
  // We only want to run this during the coprocessing of the task
  // So we can see the null values and detect the deleteion of keys in shared
  // The null values get striped out in normal task processing
  const modified = task?.meta?.modified?.shared !== undefined
  const commandArgs = task.node?.commandArgs;
  // Sync is not coprocessed (maybe it should be but worried about loops)
  //console.log("CEPShared modified:", modified, "coprocessing:", task.node.coprocessing, "sync:", commandArgs?.sync, "CEPSource:", commandArgs?.CEPSource);
  if ((task.node.coprocessing && modified)
      || (commandArgs?.sync && commandArgs?.CEPSource !== "CEPShared" && modified)) {
    utils.logTask(task, "CEPShared command:", task.node.command, "commandArgs:", task.node.commandArgs);
    let toSync = {};
    let varNames;
    if (task.node.command === "init") {
      varNames = Object.keys(task.shared);
    } else {
      varNames = Object.keys(task.meta.modified.shared);
    }
    console.log("CEPShared varNames", varNames);
    for (const varName of varNames) {
      const sharedEntry = await sharedStore_async.get(varName) || {};
      utils.logTask(task, "task.shared varName", varName);
      // Get the list of instances to update
      let familyId;
      let familyInstanceIds = [];
      // this is a huge security issue as anyone can access the system variables
      // Should prefix these variables e.g. shared.system. and could then limit access
      if (sharedEntry["system"]) {
        familyId = "system";
      } else {
        familyId = task.familyId;
      }
      //utils.logTask(task, "task.shared familyId", familyId);
      // Add this instance if it is not already tracked
      sharedEntry[familyId] = sharedEntry[familyId] || {};
      sharedEntry[familyId]["instanceIds"] = sharedEntry[familyId]["instanceIds"] || [];
      if (!sharedEntry[familyId]["instanceIds"].includes(task.instanceId)) {
        utils.logTask(task, "Adding instanceId", task.instanceId, "to familyId", familyId, "for varName", varName);
        sharedEntry[familyId]["instanceIds"].push(task.instanceId);
      }
      familyInstanceIds = sharedEntry[familyId].instanceIds;
      if (task.node.command === "init" && sharedEntry[familyId].value) {
        toSync[task.instanceId] = toSync[task.instanceId] || {};
        toSync[task.instanceId][varName] = sharedEntry[familyId].value;
      } else {
        if (!utils.deepEqual(sharedEntry[familyId].value, task.shared[varName])) {
          //utils.logTask(task, "CEPShared varName", varName, "diff", utils.js(utils.getObjectDifference(sharedEntry[familyId].value, task.shared[varName])));
          for (const instanceId of familyInstanceIds) {
            toSync[instanceId] = toSync[instanceId] || {};
            toSync[instanceId][varName] = task.shared[varName];
          }
        }
      }
      // The diff used by Task synchronization does not support efficient deleting of array elements
      //assert.strictEqual(containsArray(task.shared[varName]), false, `Shared variable ${varName} contains array`);
      //assert(!containsArray(task.shared[varName]));
      utils.logTask(task, "CEPShared Shared varName", varName, "familyId", familyId); //, "update with:", task.shared[varName]);
      if (task.node.command === "init") {
        if (!sharedEntry[familyId].value) {
          sharedEntry[familyId]["value"] = task.shared[varName];
        }
      } else {
        sharedEntry[familyId]["value"] = task.shared[varName];
      }
      await sharedStore_async.set(varName, sharedEntry);
    }
    if (task.node.command === "init") {
      task.shared = toSync[task.instanceId];
      utils.logTask(task, "CEPShared init", task.shared);
    } else {
      const instanceIds = Object.keys(toSync);
      const promises = [];
      for (const instanceId of instanceIds) {
        if (task.instanceId === instanceId) {
          utils.logTask(task, "CEPShared task.instanceId === instanceId so skipping");
          continue;
        }
        let syncUpdateTask = {
          command: "update",
          commandArgs: {
            sync: true,
            instanceId: instanceId,
            syncTask: {
              shared: toSync[instanceId],
            },
            CEPSource: "CEPShared",
            messageId: task.meta.messageId,
            // Use sync, the update risks conflicts 
            //syncUpdate: true, // Ask the Hub to convert the sync into a normal update
          },
          commandDescription: "Updating shared:" + Object.keys(toSync[instanceId]),
        };
        // Create a new Promise for each instance and push it to the promises array
        promises.push(
          commandUpdate_async(wsSendTask, syncUpdateTask).then(() => {
            utils.logTask(task, "CEPShared updating with sync instanceId:", instanceId);
          })
        );
      }
      // Wait for all promises to resolve
      await Promise.all(promises);
    }
  } else {
    //console.log("CEPShared skipping task.node.coprocessing", task.node.coprocessing, "task?.meta?.modified?.shared!==undefined", task?.meta?.modified?.shared !== undefined);
  }
}

// eslint-disable-next-line no-unused-vars
function containsArray(obj) {
  if (Array.isArray(obj)) {
    return true;
  }
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  for (let key of Object.keys(obj)) {
    if (containsArray(obj[key])) {
      return true;
    }
  }
  return false;
}

export const CEPShared = {
  cep_async,
} 