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
import { collection } from "#src/CEPs/CEPSystemLogger/tasksModel"

/*
  Pause the Task until updated (e.g. block UI events - loading page)
*/

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
          // We should rework the API for commandStart_async
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
          await commandStart_async(wsSendTask, startTask);
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
          let familyTree = {};
          let familyInstances = {};
          for (const instanceId in family) {
            const id = family[instanceId];
            if (id === T("id")) continue; // Skip the cloning Task
            const instance = await instancesStore_async.get(instanceId);
            familyInstances[instanceId] = instance;
            familyTree[instance.meta.parentInstanceId] = familyTree[instance.meta.parentInstanceId] || [];
            familyTree[instance.meta.parentInstanceId].push(instanceId);
          }
          // Iterate over each array in familyTree and sort them by instance.id
          for (const parentInstanceId in familyTree) {
            const instancesArray = familyTree[parentInstanceId];
            // Use the sort method with a custom comparison function
            instancesArray.sort((a, b) => {
              const idA = family[a];
              const idB = family[b];
              return idA.localeCompare(idB);
            });
          }
          const familyTreeKeys = Object.keys(familyTree);
          // Sort the array of parent instance IDs based on entry.id
          familyTreeKeys.sort((a, b) => {
            const idA = family[a];
            const idB = family[b];
            return idA.localeCompare(idB);
          });
          let orderedFamilyInstanceIds = [];
          for (const instanceId of prevFamilyTreeKeys) {
            orderedFamilyInstanceIds.push(instanceId);
            if (familyTree[instanceId]) {
              orderedFamilyInstanceIds.push(...familyTree[instanceId]);
            }
          }

          // Ordered list of all instances
          const prevFamily = await familyStore_async.get(T("input.cloneFamilyId"));
          let prevFamilyTree = {};
          let prevFamilyInstances = {};
          for (const instanceId in prevFamily) {
            const instance = await instancesStore_async.get(instanceId);
            prevFamilyInstances[instanceId] = instance;
            if (prevFamily.includes(instance.meta.parentInstanceId)) {
              prevFamilyTree[instance.meta.parentInstanceId] = prevFamilyTree[instance.meta.parentInstanceId] || [];
              prevFamilyTree[instance.meta.parentInstanceId].push(instanceId);
            }
          }
          // Iterate over each array in familyTree and sort them by instance.id
          for (const parentInstanceId in prevFamilyTree) {
            const instancesArray = prevFamilyTree[parentInstanceId];
            // Use the sort method with a custom comparison function
            instancesArray.sort((a, b) => {
              const idA = family[a];
              const idB = family[b];
              return idA.localeCompare(idB);
            });
          }
          const prevFamilyTreeKeys = Object.keys(familyTree);
          // Sort the array of parent instance IDs based on entry.id
          prevFamilyTreeKeys.sort((a, b) => {
            const idA = family[a];
            const idB = family[b];
            return idA.localeCompare(idB);
          });
          let orderedPrevFamilyInstanceIds = [];
          for (const instanceId of prevFamilyTreeKeys) {
            orderedPrevFamilyInstanceIds.push(instanceId);
            if (familyTree[instanceId]) {
              orderedPrevFamilyInstanceIds.push(...familyTree[instanceId]);
            }
          }

          // Check we have a matching number of entries
          if (orderedFamilyInstanceIds.length !== orderedPrevFamilyInstanceIds.length) {
            throw new Error("Cloning via requires matching familyCount");
          }

          const promises = [];
          console.log("initialized family", utils.js(family));
          console.log("initialized prevFamily", utils.js(prevFamily));
          for (let index = 0; index < orderedFamilyInstanceIds.length; index++) {
            const instanceId = orderedFamilyInstanceIds[index];
            // This assumes one instance of each id which is not always valid
            const prevInstanceId = orderedPrevFamilyInstanceIds[index];
            if (!prevInstanceId) {
              throw new Error("Cloning via requires prevInstanceId");
            }
            let prevTask;
            if (T("input.cloneContinue")) {
              console.log("initialized cloneContinue", prevInstanceId);
              prevTask = prevFamilyInstances[prevInstanceId];
            } else {
              const cloneUpdatedAt = T("input.cloneUpdatedAt");
              let query = {
                'current.instanceId': prevInstanceId,
                'updatedAt.date': { '$lte': new Date(cloneUpdatedAt) },
                '$expr': {
                  '$or': [
                    { '$not': { '$isArray': '$current.state.stable' } }, // if current.state.stable is not an array
                    {
                      '$and': [
                        { '$isArray': '$current.state.stable' }, // Check only if current.state.stable is an array
                        { '$in': ['$current.state.current', '$current.state.stable'] }
                      ]
                    }
                  ]
                }
              };              
              console.log("initialized query", utils.js(query));
              // Because of limitation in Mongoose I needed to connect directly to MongoDB
              // The issue is related with the $in operator and $current.state.stable is not always an array
              const logTask = await collection.find(query).sort({ 'updatedAt.date': -1 }).limit(1).toArray();
              //const logTask = await tasksModel.find(query).sort({ 'updatedAt.date': -1 }).limit(1);
              if (!logTask || logTask.length === 0) {
                throw new Error("Cloning via requires prevTask");
              } else {
                prevTask = logTask[0].current;
              }
            }
            let currTask = familyInstances[instanceId];
            if (currTask.id !== prevTask.id) {
              throw new Error(`Cloning via requires matching task.id ${currTask.id} ${prevTask.id}`);
            }
            currTask = utils.deepMerge(currTask, prevTask);
            prevTask["shared"] = utils.deepMerge(currTask["shared"], prevTask["shared"]) || {};
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

  return T();
};
  
export { TaskClone_async };
  