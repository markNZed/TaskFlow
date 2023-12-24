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

// Intention is to remove all entries that are not modified
function stripUnmodified(shared, modified) {
  if (modified === true) {
    return;
  }
  for (const key in shared) {
    if (modified[key] === undefined) {
      delete shared[key];
    } else if (modified[key] === true) {
      // nothing more to do
    } else {
      stripUnmodified(shared[key], modified[key]);
    }
  }
}

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {
  // We only want to run this during the coprocessing of the task
  // So we can see the null values and detect the deleteion of keys in shared
  // The null values get striped out in normal task processing
  const modified = task?.meta?.modified?.shared !== undefined
  const command = task.node.command;
  const commandArgs = task.node?.commandArgs;
  const coprocessing = task.node.coprocessing || false;
  // Sync is not coprocessed (maybe it should be but worried about loops)
  // The start command is an interesting case as to whether wew cant to run CEP, maybe a special option to allow CEP to run on start request
  // Because the task is just sending a command and we should not act on the content of the task sending the command
  if ((coprocessing && modified && command !== "start")
      || (commandArgs?.sync && commandArgs?.CEPSource !== "CEPShared" && modified)
      // For the shared.family we cannot count on meta.modified because it might be added without shared having been set in the init task
      || (coprocessing && command === "init")) {
    utils.logTask(task, "CEPShared modified:", modified, "coprocessing", coprocessing, "command:", task.node.command, "commandArgs:", task.node.commandArgs);
    let sharedClone = utils.deepClone(task.shared);
    let toSync = {};
    let topVarNames = [];
    if (task.node.command === "init") {
      // Need to check if there are family variables to add
      const family = await familyStore_async.get(task.familyId) || {};
      let familyInstanceIds = Object.keys(family);
      // filter out the current task from familyInstanceIds
      familyInstanceIds = familyInstanceIds.filter(id => id !== task.instanceId);
      utils.logTask(task, "CEPShared family init", family, task.familyId);
      if (familyInstanceIds.length > 0) {
        utils.logTask(task, "CEPShared family init task.shared", task.shared);
        // Any other instance in the family should have shared.family if it exists
        const familyTask = await instancesStore_async.get(familyInstanceIds[0]);
        if (familyTask?.shared?.family) {
          topVarNames = topVarNames.push("family");
          task["shared"] = task["shared"] || {};
          task["shared"]["family"] = utils.deepMerge(familyTask.shared.family, task.shared?.family);
        }
      } else if (task.shared?.family) {
        utils.logTask(task, "CEPShared family init only member", task.familyId);
      }
      if (task.shared) {
        topVarNames = Object.keys(task.shared);
      }
      // We could return from here
    } else {
      // Strip unmodifed from sharedClone
      // Walk sharedClone
      //utils.logTask(task, "CEPShared sharedClone modified", utils.js(task.meta.modified.shared));
      //utils.logTask(task, "CEPShared sharedClone before", utils.js(sharedClone));
      stripUnmodified(sharedClone, task.meta.modified.shared);
      //utils.logTask(task, "CEPShared sharedClone after", utils.js(sharedClone));
      topVarNames = Object.keys(sharedClone);
    }
    
    for (const topVarName of topVarNames) {
      let prefix = '';
      let childVarNames = [];
      if (topVarName === "system") {
        prefix = "system";
        childVarNames = Object.keys(sharedClone.system);
      } else if (topVarName === "family") {
        prefix = "family";
        childVarNames = Object.keys(sharedClone.family);
      } else {
        childVarNames = [ topVarName];
      }
      utils.logTask(task, "CEPShared childVarNames", childVarNames, "of", topVarName);
      for (const varName of childVarNames) {
        const sharedEntry = await sharedStore_async.get(prefix + varName) || {};
        utils.logTask(task, "sharedClone varName", prefix + " " + varName);
        // Get the list of instances to update
        let familyId;
        let familyInstanceIds = [];
        // this is a security issue as anyone can access the system variables
        // Should prefix these variables e.g. shared.system. and could then limit access
        let taskValue;
        if (prefix === "system") {
          familyId = "system";
          taskValue = sharedClone.system[varName];
        } else if (prefix === "family") {
          familyId = task.familyId;
          taskValue = sharedClone.family[varName];
        } else {
          familyId = task.familyId;
          taskValue = sharedClone[varName];
        }
        //utils.logTask(task, "sharedClone familyId", familyId);
        // Add this instance if it is not already tracked
        sharedEntry[familyId] = sharedEntry[familyId] || {};
        if (prefix === "family") {
          let family = await familyStore_async.get(familyId) || {};
          familyInstanceIds = Object.keys(family);
        } else {
          sharedEntry[familyId]["instanceIds"] = sharedEntry[familyId]["instanceIds"] || [];
          if (!sharedEntry[familyId]["instanceIds"].includes(task.instanceId)) {
            utils.logTask(task, "Adding instanceId", task.instanceId, "to familyId", familyId, "for varName", varName);
            sharedEntry[familyId]["instanceIds"].push(task.instanceId);
          }
          familyInstanceIds = sharedEntry[familyId].instanceIds;
        }
        if (task.node.command === "init" && sharedEntry[familyId].value !== undefined) {
          toSync[task.instanceId] = toSync[task.instanceId] || {};
          if (prefix) {
            toSync[task.instanceId][prefix] = {};
            toSync[task.instanceId][prefix][varName] = sharedEntry[familyId].value;
          } else {
            toSync[task.instanceId][varName] = sharedEntry[familyId].value;
          }
        // Only system tasks can write system variables
        } else if (task.id.startsWith("root.user") && familyId === "system") {
          // Nothing to do
        // Allows for read only shared variables
        // Could use the varName e.g .shared.myvar:read
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
          if (sharedEntry[familyId].value === undefined) {
            sharedEntry[familyId]["value"] = taskValue;
            utils.logTask(task, varName, "did init itself", taskValue);
          } else {
            utils.logTask(task, varName, "did init already", sharedEntry[familyId].value);
          }
        } else {
          sharedEntry[familyId]["value"] = taskValue;
        }
        await sharedStore_async.set(prefix + varName, sharedEntry);
      }
    }
    if (task.node.command === "init") {
      // The deepMerge allows us to copy from prevTask into shared.family and keep that here
      // Probably does not matter because it should be initialized anyway
      task.shared = utils.deepMerge(task.shared, toSync[task.instanceId]);
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
          commandDescription: "Updating shared:" + Object.keys(toSync[instanceId]).join(', '),
        };
        // Create a new Promise for each instance and push it to the promises array
        promises.push(
          commandUpdate_async(wsSendTask, syncUpdateTask).then(() => {
            utils.logTask(task, "CEPShared updating with sync instanceId:", instanceId);
          })
        );
      }
      // Don't wait for all promises to resolve as this could create a deadlock with two instance using CEPShared
      Promise.all(promises);
    }
  } else {
    //utils.logTask(task, "CEPShared skipping task.node.coprocessing", task.node.coprocessing, "task?.meta?.modified?.shared!==undefined", task?.meta?.modified?.shared !== undefined);
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