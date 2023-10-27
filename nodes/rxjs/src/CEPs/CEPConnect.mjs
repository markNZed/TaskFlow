/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/*
  CEP that will look after task.connections
    Detect when connections has changed
    Maintain a list of Tasks that must be update
*/
import { utils } from "#src/utils";
import { familyStore_async, getActiveTask_async, connectionsStore_async } from "#src/storage";
import { commandUpdate_async } from "#src/commandUpdate";

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {

  // If regex is empty then this wil lreturn the task instanceId
  function getInstanceIdFromFamily(family, regex) {
    console.log("getInstanceIdFromFamily regex", regex);
    if (regex === '') {
      return task.instanceId;
    }
    // Create a new regular expression based on the connection string
    const pattern = new RegExp(regex + "$", "i"); // 'i' for case-insensitive search
    const sortedIds = Object.keys(family).sort((a, b) => a.length - b.length);
    // Iterate through Ids of the object
    for (let id of sortedIds) {
      // Check if id matches the regex pattern
      if (pattern.test(id)) {
        utils.logTask(task,"CEPConnect pattern", pattern, "id", id, "instanceId", family[id]);
        return family[id]; // Return the corresponding value
      }
    }
    // Return null if no match is found
    return null;
  }

  const modifiedConnections = task?.meta?.modified?.connections !== undefined;
  const modifiedOutput = task?.meta?.modified?.output !== undefined
  const commandArgs = task.node?.commandArgs;
  const SEP = ':';
  // Sync is not coprocessed (maybe it should be but worried about loops)
  //console.log("CEPConnect modifiedConnections", modifiedConnections, "coprocessing", task.node.coprocessing, "sync", commandArgs?.sync, "CEPSource", commandArgs?.CEPSource);
  if ((modifiedConnections && (commandArgs?.CEPSource !== "CEPConnect")) || (task.node.command === "init")) {
    utils.logTask(task, "CEPConnect command", task.node.command, "commandArgs", task.node.commandArgs);

    // It might be better to add the task.meta.connectionsMap during init on the coprocessor (avoids the sync)
    // Will try to add connection before established this is why we need the storage - so we can install later
    // Could deal with deleting connections too
    // Arrays to allow for connection to multiple. Or connections could be an array

    let family = await familyStore_async.get(task.familyId) || {};
    let connectLater = await connectionsStore_async.get(family) || [];
    //console.log("family", utils.js(family), connectLater);

    let instancesToUpdate = {};
    let updateConnectLater = false;
    
    const processConnection = async (connection, task, family, connectLaterHash, connectingLater) => {
      console.log("connection", connection);

      const from = connection[0];
      const to = connection[1];
  
      const fromSplit = from.split(SEP);
      let fromId = fromSplit[0];
      const fromPath = fromSplit[1];
      const fromInstanceId = getInstanceIdFromFamily(family, fromId);
      
      if (fromInstanceId === task.instanceId) {
          fromId = task.id;
      }
      
      const toSplit = to.split(SEP);
      let toId = toSplit[0];
      const toPath = toSplit[1];
      const toInstanceId = getInstanceIdFromFamily(family, toId);
      
      if (toInstanceId === task.instanceId) {
          toId = task.id;
      }

      if (fromId === task.id) {
        utils.logTask(task, "CEPConnect fromId === task.id");
        if (!task?.meta?.connectionsMap || !task.meta.connectionsMap[toId]) {      
          if (toInstanceId) {
            if (connectingLater) {
              task.connections.push([
                `${SEP}${fromPath}`,
                `${toId}${SEP}${toPath}`
              ]);
            } else {
              connection[0] = `${task.id}${SEP}${fromPath}`;
              connection[1] = `${toId}${SEP}${toPath}`;
            }
            task.meta = task.meta || {};
            task.meta.connectionsMap = task.meta.connectionsMap || {};
            task.meta.connectionsMap[toId] = toInstanceId;
            utils.logTask(task, "CEPConnect fromId === task.id from path", fromPath, "toId", toId, "toPath", toPath, "toInstanceId", toInstanceId, "connection", connection);
            instancesToUpdate[task.instanceId] = task;
          } else {
            const from = `${task.id}${SEP}${fromPath}`;
            const to = `${toId}${SEP}${toPath}`;
            if (!connectLaterHash[from + to]) {
              connection[0] = null;
              connection[1] = null;
              const newConnection = [from, to];
              utils.logTask(task, "CEPConnect fromId === task.id connectLater", newConnection);
              connectLater.push(newConnection);
              connectLaterHash[from + to] = true;
              updateConnectLater = true;
            }
          }
        }
      } else if (toId === task.id) {
        utils.logTask(task, "CEPConnect toId === task.id");
        let connected = false;
        if (fromInstanceId) {
          const fromTask = await getActiveTask_async(fromInstanceId);
          if (fromTask?.instanceId) {
            if (!fromTask?.meta?.connectionsMap || !fromTask.meta.connectionsMap[task.id]) {
              fromTask["connections"] =  fromTask.connections || [];
              fromTask.connections.push([`${fromTask.id}${SEP}${fromPath}`, `${task.id}${SEP}${toPath}`]);
              fromTask.meta = fromTask.meta || {};
              fromTask.meta.connectionsMap = fromTask.meta.connectionsMap || {};
              fromTask.meta.connectionsMap[task.id] = task.instanceId;
              utils.logTask(task, "CEPConnect toId === task.id fromId", fromId, "path", fromPath, "toPath", toPath, "fromInstanceId", fromInstanceId);
              instancesToUpdate[fromTask.instanceId] = fromTask;
              connected = true;
            }
          }
        }
        if (!connected) {
          const from = `${fromId}${SEP}${fromPath}`;
          const to = `${task.id}${SEP}${toPath}`;
          if (!connectLaterHash[from + to]) {
            connection[0] = null;
            connection[1] = null;
            const newConnection = [from, to];
            utils.logTask(task, "CEPConnect toId === task.id connectLater", newConnection);
            connectLater.push(newConnection);
            connectLaterHash[from + to] = true;
            updateConnectLater = true;
          }
        }
      }
    };

    // To avoid adding the same entry to connectLater
    let connectLaterHash = {}
    for (let connection of connectLater) {
      const from = connection[0];
      const to = connection[1];
      connectLaterHash[from + to] = true;
    }
    utils.logTask(task, "CEPConnect connectLaterHash1", connectLaterHash);
    
    for (let connection of task.connections) {
      console.log("processConnection task.connections", connection);
      await processConnection(connection, task, family, connectLaterHash, false);
    }

    utils.logTask(task, "CEPConnect task.connections", task.connections);
    
    for (let connection of utils.deepClone(connectLater)) {
      console.log("processConnection connectLater", connection);
      await processConnection(connection, task, family, connectLaterHash, true);
    }

    utils.logTask(task, "CEPConnect connectLater", connectLater);
    
    // Could clean out connectLater entries that are null
    if (updateConnectLater) {
      await connectionsStore_async.set(family, connectLater);
    }

    const promises = [];

    console.log("instancesToUpdate", Object.keys(instancesToUpdate));

    for (const instanceId of Object.keys(instancesToUpdate)) {
      utils.logTask(task, "CEPConnect syncUpdate",  instancesToUpdate[instanceId].connections);
      let syncUpdateTask = {
        command: "update",
        commandArgs: {
          sync: true,
          instanceId: instanceId,
          syncTask: {
              connections: instancesToUpdate[instanceId].connections,
              meta: {
                connectionsMap: instancesToUpdate[instanceId].meta.connectionsMap,
              }
          },
          CEPSource: "CEPConnect",
          messageId: task.meta.messageId,
        },
        commandDescription: `CEPConnect creation for ${instanceId}`,
      };
      promises.push(commandUpdate_async(wsSendTask, syncUpdateTask));
    }
    
    await Promise.all(promises);

  }

  //utils.logTask(task, "CEPConnect modifiedOutput", modifiedOutput);

  // Update any connections
  if (modifiedOutput) {
    const T = utils.createTaskValueGetter(task);
    const taskConnections = task.connections || [];
    let instancesToUpdate = {};
    for (let connection of taskConnections) {
      const from = connection[0];
      const to = connection[1];
      const fromSplit = from.split(SEP)
      const fromId = fromSplit[0];
      const fromPath = fromSplit[1];
      const toSplit = to.split(SEP)
      const toId = toSplit[0];
      const toPath = toSplit[1];
      utils.logTask(task, "CEPConnect output from", from, "fromId", fromId, "fromPath", fromPath, "to", to, "toId", toId, "toPath", toPath, connection);
      if ((from.startsWith(SEP) || fromId === task.id) && task?.meta?.connectionsMap && task.meta.connectionsMap[toId]) {
        const toTask = await getActiveTask_async(task.meta.connectionsMap[toId]);
        if (toTask && toTask.instanceId) {
          const Tto = utils.createTaskValueGetter(toTask);
          // LOG HERE
          const deepEqual = utils.deepEqual(T(fromPath), Tto(toPath));
          //utils.logTask(task, "CEPConnect deepEqual", deepEqual, T(fromPath), Tto(toPath));
          if (!deepEqual) {
            Tto(toPath, T(fromPath));
            instancesToUpdate[Tto("instanceId")] = Tto();
          }
        }
      }
    }

    const promises = [];

    for (const instanceId of Object.keys(instancesToUpdate)) {
      let syncUpdateTask = {
        command: "update",
        commandArgs: {
          sync: true,
          instanceId: instanceId,
          syncTask: instancesToUpdate[instanceId],
          CEPSource: "CEPConnect",
          messageId: task.meta.messageId,
        },
        commandDescription: `CEPConnect update for ${instanceId}`,
      };
      promises.push(commandUpdate_async(wsSendTask, syncUpdateTask));
    }
    
    await Promise.all(promises);
  }

}

export const CEPConnect = {
  cep_async,
} 