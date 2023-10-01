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
import assert from 'assert';

// Could have a familyId of system that works for system variables?
// But this can be different per user etc
// The raw data is the same but not what is attached to the task

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {
  // We only want to run this during the coprocessing of the task
  // So we can see the null values and detect the deleteion of keys in shared
  // The null values get striped out in normal task processing
  if (task.processor.coprocessing && task?.meta?.modified?.shared !== undefined) {
    utils.logTask(task, "command:", task.processor.command, "commandArgs:", task.processor.commandArgs);
    let toSync = {};
    let varNames;
    if (task.processor.command === "init") {
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
      // clarify this
      familyId = task.meta.systemFamilyId || task.familyId;
      //utils.logTask(task, "task.shared familyId", familyId);
      // Add this instance if it is not already tracked
      sharedEntry[familyId] = sharedEntry[familyId] || {};
      sharedEntry[familyId]["instanceIds"] = sharedEntry[familyId]["instanceIds"] || [];
      if (!sharedEntry[familyId]["instanceIds"].includes(task.instanceId)) {
        //utils.logTask(task, "Adding instanceId", task.instanceId, "to familyId sharedEntry", familyId, "for varName", varName);
        sharedEntry[familyId]["instanceIds"].push(task.instanceId);
      }
      familyInstanceIds = sharedEntry[familyId].instanceIds;
      for (const instanceId of familyInstanceIds) {
        toSync[instanceId] = toSync[instanceId] || {};
        if (task.processor.command === "init") {
          if (sharedEntry[familyId].value) {
            //utils.logTask(task, "CEPShared sharedEntry value set for varName", varName);
            toSync[instanceId][varName] = sharedEntry[familyId].value;
          } else {
            //utils.logTask(task, "CEPShared sharedEntry value set for varName", varName);
            toSync[instanceId][varName] = task.shared[varName];
          } 
        } else {
          toSync[instanceId][varName] = task.shared[varName];
        }
      }
      // The diff used by Task synchronization does not support efficient deleting of array elements
      assert.strictEqual(containsArray(task.shared[varName]), false, `Shared variable ${varName} contains array`);
      assert(!containsArray(task.shared[varName]));
      utils.logTask(task, "CEPShared Shared varName", varName, "familyId", familyId); //, "update with:", task.shared[varName]);
      if (task.processor.command === "init") {
        if (!sharedEntry[familyId].value) {
          sharedEntry[familyId]["value"] = task.shared[varName];
        }
      } else {
        sharedEntry[familyId]["value"] = task.shared[varName];
      }
      await sharedStore_async.set(varName, sharedEntry);
    }
    if (task.processor.command === "init") {
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
            }
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
    //console.log("CEPShared skipping task.processor.coprocessing", task.processor.coprocessing, "task?.meta?.modified?.shared!==undefined", task?.meta?.modified?.shared !== undefined);
  }
}

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