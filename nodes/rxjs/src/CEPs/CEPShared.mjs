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
import { sharedStore_async, familyStore_async, instancesStore_async } from "#src/storage";
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
  const command = task.node.command;
  const commandArgs = task.node?.commandArgs;
  // Sync is not coprocessed (maybe it should be but worried about loops)
  //console.log("CEPShared modified:", modified, "coprocessing:", task.node.coprocessing, "sync:", commandArgs?.sync, "CEPSource:", commandArgs?.CEPSource);
  if ((task.node.coprocessing && modified)
      || (commandArgs?.sync && commandArgs?.CEPSource !== "CEPShared" && modified)
      // For the shared.family we cannot count on meta.modified because it might be added without shared having been set in the init task
      || (task.node.coprocessing && command === "init")) {
    utils.logTask(task, "CEPShared command:", task.node.command, "commandArgs:", task.node.commandArgs);
    let toSync = {};
    let varNames = [];
    if (task.node.command === "init") {
      // Need to check if there are family variables to add
      const family = await familyStore_async.get(task.familyId) || {};
      let familyInstanceIds = Object.values(family);
      // filter out the current task from familyInstanceIds
      familyInstanceIds = familyInstanceIds.filter(id => id !== task.instanceId);
      if (familyInstanceIds.length > 0) {
        // Any other instance in the family should have shared.family if it exists
        const familyTask = await instancesStore_async.get(familyInstanceIds[0]);
        if (familyTask?.shared?.family) {
          varNames = varNames.push("family");
          task["shared"] = task["shared"] || {};
          task["shared"]["family"] = utils.deepMerge(familyTask.shared.family, task?.shared?.family);
        }
      }
      if (task.shared) {
        varNames = Object.keys(task.shared);
      }
      // We could return from here
    } else {
      varNames = Object.keys(task.meta.modified.shared);
    }
    console.log("CEPShared varNames", varNames);
    for (const topVarName of varNames) {
      let prefix = '';
      let adjustedVarNames;
      if (topVarName === "system") {
        prefix = "system";
        adjustedVarNames = Object.keys(task.shared.system)
      } else if (topVarName === "family") {
        prefix = "family";
        adjustedVarNames = Object.keys(task.shared.family)
      } else {
        adjustedVarNames = [ topVarName];
      }
      for (const varName of adjustedVarNames) {
        const sharedEntry = await sharedStore_async.get(prefix + varName) || {};
        utils.logTask(task, "task.shared varName", prefix + " " + varName);
        // Get the list of instances to update
        let familyId;
        let familyInstanceIds = [];
        // this is a huge security issue as anyone can access the system variables
        // Should prefix these variables e.g. shared.system. and could then limit access
        let taskValue;
        if (prefix === "system") {
          familyId = "system";
          taskValue = task.shared.system[varName];
        } else if (prefix === "family") {
          familyId = task.familyId;
          taskValue = task.shared.family[varName];
        } else {
          familyId = task.familyId;
          taskValue = task.shared[varName];
        }
        //utils.logTask(task, "task.shared familyId", familyId);
        // Add this instance if it is not already tracked
        sharedEntry[familyId] = sharedEntry[familyId] || {};
        if (prefix === "family") {
          let family = await familyStore_async.get(familyId) || {};
          familyInstanceIds = Object.values(family);
        } else {
          sharedEntry[familyId]["instanceIds"] = sharedEntry[familyId]["instanceIds"] || [];
          if (!sharedEntry[familyId]["instanceIds"].includes(task.instanceId)) {
            utils.logTask(task, "Adding instanceId", task.instanceId, "to familyId", familyId, "for varName", varName);
            sharedEntry[familyId]["instanceIds"].push(task.instanceId);
          }
          familyInstanceIds = sharedEntry[familyId].instanceIds;
        }
        if (task.node.command === "init" && sharedEntry[familyId].value) {
          toSync[task.instanceId] = toSync[task.instanceId] || {};
          if (prefix) {
            toSync[task.instanceId][prefix] = {};
            toSync[task.instanceId][prefix][varName] = sharedEntry[familyId].value;
          } else {
            toSync[task.instanceId][varName] = sharedEntry[familyId].value;
          }
        // Only systme tasks can write system variables
        } else if (task.id.startsWith("root.user") && familyId === "system") {
          // Nothing to do
        // Allows for read only shared variables
        } else if (task.config?.shared?.[varName] !== "read") {
          if (!utils.deepEqual(sharedEntry[familyId].value, taskValue)) {
            //utils.logTask(task, "CEPShared varName", varName, "diff", utils.js(utils.getObjectDifference(sharedEntry[familyId].value, taskValue)));
            for (const instanceId of familyInstanceIds) {
              toSync[instanceId] = toSync[instanceId] || {};
              if (prefix) {
                toSync[instanceId][prefix] = {};
                toSync[instanceId][prefix][varName] = taskValue;
              } else {
                toSync[instanceId][varName] = taskValue;
              }
            }
          }
        }
        // The diff used by Task synchronization does not support efficient deleting of array elements
        //assert.strictEqual(containsArray(taskValue), false, `Shared variable ${varName} contains array`);
        //assert(!containsArray(taskValue));
        utils.logTask(task, "CEPShared Shared varName", varName, "familyId", familyId); //, "update with:", taskValue);
        if (task.node.command === "init") {
          if (!sharedEntry[familyId].value) {
            sharedEntry[familyId]["value"] = taskValue;
          }
        } else {
          sharedEntry[familyId]["value"] = taskValue;
        }
        await sharedStore_async.set(prefix + varName, sharedEntry);
      }
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