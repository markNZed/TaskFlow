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
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";
import { sharedStore_async } from "../storage.mjs";
import { commandUpdate_async } from "../commandUpdate.mjs";
import assert from 'assert';

// eslint-disable-next-line no-unused-vars
const TaskSystemShared_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  if (T("processor.commandArgs.sync")) {utils.logTask(T(), "Ignore sync operations")}
  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

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

  // eslint-disable-next-line no-unused-vars
  async function CEPShared(functionName, wsSendTask, CEPinstanceId, task, args) {
    // We only want to run this during the coprocessing of the task
    // So we can see the null values and detect the deleteion of keys in shared
    // The null values get striped out in normal task processing
    if (task.processor.coprocessing && task.shared) {
      utils.logTask(task, "task.processor.command", task.processor.command, "task.processor.commandArgs", task.processor.commandArgs);
      let toSync = {};
      const varNames = Object.keys(task.shared);
      for (const varName of varNames) {
        const sharedEntry = await sharedStore_async.get(varName) || {};
        utils.logTask(task, "task.shared varName", varName);
        // Get the list of instances to update
        // Maybe we need a systemFamilyId
        let familyId;
        let familyInstanceIds = [];
        let updateStorage = false;
        // clarify this
        familyId = task.meta.systemFamilyId || task.familyId;
        // Add this instance if it is not already tracked
        sharedEntry[familyId] = sharedEntry[familyId] || {};
        sharedEntry[familyId]["instanceIds"] = sharedEntry[familyId]["instanceIds"] || [];
        if (!sharedEntry[familyId]["instanceIds"].includes(task.instanceId)) {
          sharedEntry[familyId]["instanceIds"].push(task.instanceId);
        }
        //console.log("sharedEntry[familyId].value", sharedEntry[familyId]["value"]);
        const identical = utils.deepEqual(sharedEntry[familyId].value, task.shared[varName]);
        if (!identical) {
          familyInstanceIds = sharedEntry[familyId].instanceIds;
          updateStorage = true;
          utils.logTask(task, "CEPShared isSystemTask familyInstanceIds:", familyInstanceIds, "not identical"); 
          //console.log("CEPShared Difference", utils.getObjectDifference(sharedEntry[familyId].value, task.shared[varName], true));
        } else {
          utils.logTask(task, "Identical");
          //console.log("CEPShared Difference", utils.getObjectDifference(sharedEntry[familyId].value, task.shared[varName], true));
          continue;
        }
        for (const instanceId of familyInstanceIds) {
          toSync[instanceId] = toSync[instanceId] || {};
          if (task.processor.command === "init") {
            if (sharedEntry && sharedEntry[familyId].value) {
              toSync[instanceId][varName] = sharedEntry[familyId].value;
            } else {
              toSync[instanceId][varName] = task.shared[varName];
            } 
          } else {
            toSync[instanceId][varName] = task.shared[varName];
          }
        }
        if (updateStorage) {
          // The diff used by Task synchronization does not support efficient deleting of array elements
          assert.strictEqual(containsArray(task.shared[varName]), false, `Shared variable ${varName} contains array`);
          assert(!containsArray(task.shared[varName]));
          utils.logTask(task, "CEPShared Shared varName", varName, "update with:", task.shared[varName]);
          sharedEntry[familyId]["value"] = task.shared[varName];
          await sharedStore_async.set(varName, sharedEntry);
        }
      }
      if (task.processor.command === "init") {
        task.shared = toSync[task.instanceId];
        utils.logTask(task, "CEPShared task.processor.command === init", task.shared);
      } else {
        const instanceIds = Object.keys(toSync);
        for (const instanceId of instanceIds) {
          if (task.instanceId === instanceId) {
            utils.logTask(task, "CEPShared task.instanceId === instanceId so skipping");
            continue;
          }
          let syncDiff = {}
          syncDiff["shared"] = toSync[instanceId];
          syncDiff["instanceId"] = instanceId;
          await commandUpdate_async(wsSendTask, task, syncDiff, true);
          utils.logTask(task, "CEPShared updating with sync"); 
        }
      }
    } else {
      console.log("CEPShared skipping task.processor.coprocessingDone", task.processor.coprocessingDone, "task.shared", task.shared !== undefined);
    }
  }

  switch (T("state.current")) {
    case "start": {
      if (!T("processor.coprocessingDone")) {
        CEPFunctions.register("CEPShared", CEPShared);
      }
      break;
    }
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemShared_async };