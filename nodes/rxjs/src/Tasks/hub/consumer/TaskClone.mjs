/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { familyStore_async, instancesStore_async } from "#src/storage";
// eslint-disable-next-line no-unused-vars
import { commandUpdate_async } from "#src/commandUpdate";
import { commandStart_async } from "#src/commandStart";

// eslint-disable-next-line no-unused-vars
const TaskClone_async = async function (wsSendTask, T, FSMHolder) {

  //   Set task.meta.cloning true
  let nextState = T("state.current");
  while (!T("command") && nextState) {
    T("state.current", nextState);
    nextState = null;
    switch (T("state.current")) {
        case "start": {
          if (T("input.cloneInstanceId")) {
            utils.logTask(T(), "started with input.cloneInstanceId:", T("input.cloneInstanceId"));
            nextState = "cloneFounder";
          }
          break;
        }
        case "cloneFounder": {
          // We should reowrk the API for commandStart_async
          let startTask = utils.deepClone(T());
          startTask = utils.deepMerge(startTask, {
            command: "start",
            commandArgs: {
              init: {
                id: T("input.cloneId"),
                meta: {
                  founder: true,
                },
                shared: {
                  family: {
                    cloning: true,
                  },
                },
              },
            },
            commandDescription: `Cloning of ${T("input.cloneInstanceId")} into family ${T("familyId")}`,
          });
          commandStart_async(wsSendTask, startTask);
          T("state.current", "waitingForFamily");
          T("command", "update");
          T("commandDescription", "Have cloned founder");
          break;
        }
        case "waitingForFamily": {
          const sharedFamily = T("shared.family");
          let initialized = false;
          if (sharedFamily && Object.keys(sharedFamily)) {
            initialized = true;
            for (const instanceId in sharedFamily) {
              if (sharedFamily[instanceId]?.nodes) {
                for (const nodeId in sharedFamily[instanceId].nodes) {
                  if (!sharedFamily[instanceId]["nodes"][nodeId].initialized) {
                    utils.logTask(T(), "instanceId ", instanceId, "node", nodeId, "not initialized");
                    initialized = false;
                    //break;
                  } else {
                    utils.logTask(T(), "instanceId ", instanceId, "node", nodeId, "initialized");
                  }
                }
              }
            }
          }
          if (initialized) {
            nextState = "initialized";
          }
          break;
        }
        case "initialized": {
          // Once all the family has initialized (and paused) we can update each with the cloned state and then play them
          const family = await familyStore_async.get(T("familyId"));
          const prevFamily = await familyStore_async.get(T("input.cloneFamilyId"));
          const promises = [];
          for (const id in family) {
            if (id === T("id")) continue;
            const prevInstanceId = prevFamily[id];
            if (!prevInstanceId) {
              throw new Error("Cloning via requires prevInstanceId");
            }
            let prevTask = await instancesStore_async.get(prevInstanceId);
            const instanceId = family[id];
            let currTask = await instancesStore_async.get(instanceId);
            prevTask["shared"] = utils.deepMerge(currTask["shared"], prevTask["shared"]);
            prevTask.shared["family"] = currTask.shared.family; // So we can clone a clone without the prev family
            prevTask["meta"] = utils.deepMerge(currTask["meta"], prevTask["meta"]);
            prevTask.meta["cloneFamilyId"] = prevTask.familyId;
            prevTask.meta["cloneInstanceId"] = prevTask.instanceId;
            prevTask.meta["prevInstanceId"] = currTask.meta.prevInstanceId;
            prevTask.meta["requestsThisMinute"] = currTask.meta.requestsThisMinute ?? 0;
            prevTask.meta["requestCount"] = currTask.meta.requestCount ?? 0;
            prevTask.meta["createdAt"] = currTask.meta["createdAt"];
            prevTask.meta["updatedAt"] = currTask.meta["updatedAt"];
            prevTask.meta["updateCount"] = currTask.meta["updateCount"] = 0;
            prevTask.meta["broadcastCount"] = currTask.meta["updateCount"] = 0;
            prevTask.familyId = T("familyId");
            prevTask["instanceId"] = currTask.instanceId;
            console.log("TaskClone_async to update", prevTask.instanceId)
            // eslint-disable-next-line no-unused-vars
            let syncUpdateTask = {
              command: "update",
              commandArgs: {
                sync: true,
                instanceId: currTask.instanceId,
                syncTask: prevTask,
                messageId: T("meta.messageId"),
              },
              commandDescription: `TaskClone_async update for ${currTask.id}`,
            };
            promises.push(
              commandUpdate_async(wsSendTask, syncUpdateTask).then(() => {
                utils.logTask(T(), "TaskClone_async updating with sync task id:", currTask.id);
              })
            );
          }
           // Wait for all promises to resolve
          await Promise.all(promises);
          T("state.current", "done");
          T("shared.family.cloning", false);
          T("command", "update");
          T("commandDescription", "Clone initialized");
          break;
        }
        case "done": {
          break;
        }
        default:
          console.log("WARNING unknown state : " + T("state.current"));
          return null;
    }
      // The while loop can move to next state by assigning nextState
    if (nextState) {
      console.log(`nextState ${nextState}`);
    } else {
      console.log(`command ${T("command")}`);
    }
  }

  return null;
};
  
export { TaskClone_async };
  