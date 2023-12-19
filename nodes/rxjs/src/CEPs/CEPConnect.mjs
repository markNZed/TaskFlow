/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/*
  CEP that will look after task.connections
    Detect when connections has changed
    Maintain a list of Tasks that must be updated
  
  Could add the connection to the To taks also so we can see where connections are coming from in the Task
*/
import { utils } from "#src/utils";
import { familyStore_async, getActiveTask_async, connectionsStore_async } from "#src/storage";
import { commandUpdate_async } from "#src/commandUpdate";

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {

  // If regex is empty then this will return the task instanceId
  function getInstanceIdFromFamily(family, regex) {
    //getInstanceIdFromFamily regex interview
    console.log("getInstanceIdFromFamily regex", regex);
    if (regex === '') {
      return task.instanceId;
    }
    // Create a new regular expression based on the connection string
    const pattern = new RegExp(regex + "$", "i"); // 'i' for case-insensitive search
    const sortedInstanceIds = Object.keys(family).sort((a, b) => family[a].length - family[b].length);
    // Iterate through Ids of the object
    for (let instanceId of sortedInstanceIds) {
      // Check if id matches the regex pattern
      if (pattern.test(family[instanceId])) {
        utils.logTask(task,"CEPConnect pattern", pattern, "instanceId", instanceId, "id", family[instanceId]);
        return instanceId; // Return the corresponding value
      }
    }
    // Return null if no match is found
    return null;
  }

  const modifiedConnections = utils.checkModified(task, "connections");
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
    let connectLater = await connectionsStore_async.get(task.familyId) || [];
    //console.log("family", utils.js(family), connectLater);

    let instancesToEstablish = {};
    let instancesToInit = {};
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
          const from = `${task.id}${SEP}${fromPath}`;
          const to = `${toId}${SEP}${toPath}`;
          if (toInstanceId) {
            if (connectingLater) {
              utils.logTask(task, "CEPConnect fromId === task.id adding connection", from, to);
              // It would be nice to lean up the connections rather than just pushing
              task.connections.push([from, to]);
              connectLaterHash[from + to] = "done";
              updateConnectLater = true;
            } else {
              utils.logTask(task, "CEPConnect fromId === task.id replacing connection", from, to);
              connection[0] = from;
              connection[1] = to;
            }
            task.meta = task.meta || {};
            task.meta.connectionsMap = task.meta.connectionsMap || {};
            task.meta.connectionsMap[toId] = toInstanceId;
            instancesToEstablish[task.instanceId] = task;
            // Need to initialize the values in to task
            const toTask = await getActiveTask_async(toInstanceId);
            const Tto = utils.createTaskValueGetter(toTask);
            const Tfrom = utils.createTaskValueGetter(task);
            utils.logTask(task, "CEPConnect init", toPath, Tfrom(fromPath));
            if (Tfrom(fromPath) !== undefined) {
              const Tupdate = utils.createTaskValueGetter({});
              Tupdate(toPath, Tfrom(fromPath));
              instancesToInit[Tto("instanceId")] = instancesToInit[Tto("instanceId")] || {};
              instancesToInit[Tto("instanceId")] = utils.deepMerge(instancesToInit[Tto("instanceId")], Tupdate());
              utils.logTask(task, "CEPConnect init fromPath", fromPath, "toPath", toPath); 
            }
          } else {
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
        utils.logTask(task, "CEPConnect toId === task.id fromInstanceId", fromInstanceId);
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
              instancesToEstablish[fromTask.instanceId] = fromTask;
              connected = true;
              // Need to initialize the values in this to task
              const Tto = utils.createTaskValueGetter(task);
              const Tfrom = utils.createTaskValueGetter(fromTask);
              utils.logTask(task, "CEPConnect init", toPath, Tfrom(fromPath));
              if (Tfrom(fromPath) !== undefined) {
                const Tupdate = utils.createTaskValueGetter({});
                Tupdate(toPath, Tfrom(fromPath));
                instancesToInit[Tto("instanceId")] = instancesToInit[Tto("instanceId")] || {};
                instancesToInit[Tto("instanceId")] = utils.deepMerge(instancesToInit[Tto("instanceId")], Tupdate());
                utils.logTask(task, "CEPConnect init fromPath", fromPath, "toPath", toPath); 
              }
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
      } else {
        if (!connectLaterHash[from + to]) {
          connection[0] = null;
          connection[1] = null;
          const newConnection = [from, to];
          utils.logTask(task, "CEPConnect toId !== task.id and fromId !== task.id connectLater", newConnection);
          connectLater.push(newConnection);
          connectLaterHash[from + to] = true;
          updateConnectLater = true;
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
    
    if (task.connections) {
      for (let connection of task.connections) {
        console.log("processConnection task.connections", connection);
        await processConnection(connection, task, family, connectLaterHash, false);
      }
    }

    utils.logTask(task, "CEPConnect task.connections", task.connections);
    
    for (let connection of utils.deepClone(connectLater)) {
      console.log("processConnection connectLater", connection);
      await processConnection(connection, task, family, connectLaterHash, true);
    }

    utils.logTask(task, "CEPConnect connectLater", connectLater);
    
    if (updateConnectLater) {
      let updatedConnectLater = [];
      // Remove those that are "done"
      for (let connection of connectLater) {
        const from = connection[0];
        const to = connection[1];
        if (connectLaterHash[from + to] === "done") {
          continue;
        } else {
          updatedConnectLater.push(connection);
        }
      }
      await connectionsStore_async.set(task.familyId, updatedConnectLater);
    }

    const promises = [];

    //console.log("instancesToEstablish", Object.keys(instancesToEstablish));

    for (const instanceId of Object.keys(instancesToEstablish)) {  
      let syncUpdateTask = {
        command: "update",
        commandArgs: {
          sync: true,
          instanceId: instanceId,
          syncTask: {
            connections: instancesToEstablish[instanceId].connections,
            meta: {
              connectionsMap: instancesToEstablish[instanceId].meta.connectionsMap,
            }
          },
          CEPSource: "CEPConnect",
          messageId: task.meta.messageId,
        },
        commandDescription: `CEPConnect creation for ${instanceId}`,
      };
      utils.logTask(task, "CEPConnect sync establish connection syncUpdateTask",  utils.js(syncUpdateTask));
      promises.push(commandUpdate_async(wsSendTask, syncUpdateTask));
    }

    for (const instanceId of Object.keys(instancesToInit)) {  
      let syncUpdateTask = {
        command: "update",
        commandArgs: {
          sync: true,
          instanceId: instanceId,
          syncTask: instancesToInit[instanceId],
          CEPSource: "CEPConnect",
          messageId: task.meta.messageId,
        },
        commandDescription: `CEPConnect init for ${instanceId}`,
      };
      utils.logTask(task, "CEPConnect sync init connections",  utils.js(syncUpdateTask));
      promises.push(commandUpdate_async(wsSendTask, syncUpdateTask));
    }

    await Promise.all(promises);

  }

  //utils.logTask(task, "CEPConnect modifiedOutput", modifiedOutput);

  // Update any connections
  if (task.connections && task.connections.length > 0) {

    const T = utils.createTaskValueGetter(task);
    const taskConnections = task.connections || [];
    let instancesToUpdate = {};
    for (let connection of taskConnections) {
      const from = connection[0];
      const to = connection[1];
      if (from === null) {
        // Has been move dinto connectLater
        continue;
      }
      const fromSplit = from.split(SEP)
      const fromId = fromSplit[0];
      const fromPath = fromSplit[1];
      const toSplit = to.split(SEP)
      const toId = toSplit[0];
      const toPath = toSplit[1];
      if ((from.startsWith(SEP) || fromId === task.id) && task?.meta?.connectionsMap && task.meta.connectionsMap[toId]) {
        // Could be undefined in the case of a sync that does not include this path
        utils.logTask(task, "CEPConnect modified", "fromPath", fromPath, "T(fromPath)", T(fromPath));
        // Could use the meta.modified to detect a change but also need to track if the connection has been initialized in that case
        if (T(fromPath) !== undefined) {
          const toTask = await getActiveTask_async(task.meta.connectionsMap[toId]);
          if (toTask && toTask.instanceId) {
            const Tto = utils.createTaskValueGetter(toTask);
            // LOG HERE
            const deepEqual = utils.deepEqual(T(fromPath), Tto(toPath));
            utils.logTask(task, "CEPConnect deepEqual", deepEqual);
            if (!deepEqual) {
              const Tupdate = utils.createTaskValueGetter({});
              Tupdate(toPath, T(fromPath));
              console.log("CEPConnect Tto(instanceId)", Tto("instanceId"), "Tupdate", Tupdate());
              instancesToUpdate[Tto("instanceId")] = instancesToUpdate[Tto("instanceId")] || {};
              instancesToUpdate[Tto("instanceId")] = utils.deepMerge(instancesToUpdate[Tto("instanceId")], Tupdate());
            }
          }
        }
      }
    }

    const promises = [];

    for (const instanceId of Object.keys(instancesToUpdate)) {
      utils.logTask(task, "CEPConnect sync connection value",  instancesToUpdate[instanceId]);
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