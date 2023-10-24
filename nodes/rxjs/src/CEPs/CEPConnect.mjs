/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/*
  CEP that will look after task.connections
    Detect when connections has changed
    Maintain a list of Tasks that must be updated
    During init set the content of task.input amd/or task.output
    Organise by familyId 
    If there is no familyId then match all familyIds

    'chat:output.sending': 'root.user.dtf.rag-dtf:input.test'
    Will not match with chat need to remove chat

*/
import { utils } from "#src/utils";
import { familyStore_async, getActiveTask_async, connectionsStore_async } from "#src/storage";
import { commandUpdate_async } from "#src/commandUpdate";

// eslint-disable-next-line no-unused-vars
async function cep_async(wsSendTask, CEPInstanceId, task, args) {

  function getInstanceFromFamily(family, regex) {
    // Create a new regular expression based on the connection string
    const pattern = new RegExp(regex + "$", "i"); // 'i' for case-insensitive search
    const sortedKeys = Object.keys(family).sort((a, b) => a.length - b.length);
    // Iterate through keys of the object
    for (let key of sortedKeys) {
      // Check if key matches the regex pattern
      if (pattern.test(key)) {
        utils.logTask(task,"CEPConnect pattern", pattern, "key", key, "value", family[key]);
        return family[key]; // Return the corresponding value
      }
    }
    // Return null if no match is found
    return null;
  }

  // We only want to run this during the coprocessing of the task
  // So we can see the null values and detect the deleteion of keys in connections
  // The null values get striped out in normal task processing
  const modifiedConnections = task?.meta?.modified?.connections !== undefined;
  const modifiedOutput = task?.meta?.modified?.output !== undefined
  const commandArgs = task.node?.commandArgs;
  const SEP = ':';
  // Sync is not coprocessed (maybe it should be but worried about loops)
  //console.log("CEPConnect modifiedConnections", modifiedConnections, "coprocessing", task.node.coprocessing, "sync", commandArgs?.sync, "CEPSource", commandArgs?.CEPSource);
  if (modifiedConnections && (commandArgs?.CEPSource !== "CEPConnect")) {
    utils.logTask(task, "CEPConnect command", task.node.command, "commandArgs", task.node.commandArgs);

    // It might be better to add the connectsion IDMAP during init on the coprocessor (avoids the sync)

    let family = await familyStore_async.get(task.familyId) || {};
    let connectLater = await connectionsStore_async.get(family) || {};
    
    //console.log("family", utils.js(family), connectLater);
    // Will try to add connection before established this is why we need the storage - so we can install later

    // Could deal with deleting connections too 
    let taskConnections = utils.deepClone(task.connections) || {};
    let allConnections = {...taskConnections, ...connectLater};
    let instancesToUpdate = {};
    let updateConnectLater = false;
    for (const from of Object.keys(allConnections)) {
      if (from === "IDMAP") continue;
      // Should add assertions to check for the format here
      const fromSplit = from.split(SEP);
      let fromId = fromSplit[0];
      const fromPath = fromSplit[1];
      const to = allConnections[from];
      const toSplit = to.split(SEP);
      let toId = toSplit[0];
      const toPath = toSplit[1];
      const toInstanceId = getInstanceFromFamily(family, toId);
      const fromInstanceId = getInstanceFromFamily(family, fromId);
      if (toInstanceId === task.instanceId || to.startsWith(SEP)) {
        toId = task.id
      } 
      if (fromInstanceId === task.instanceId || from.startsWith(SEP) ) {
        fromId = task.id
      } 
      //console.log("connection from", from, "to", to);
      if (fromId === task.id) {
        if (!task?.connections?.IDMAP || !task.connections.IDMAP[toId]) {      
          if (toInstanceId) {
            task["connections"] = task.connections || {};
            task.connections["IDMAP"] = task.connections.IDMAP || {};
            task.connections.IDMAP[toId] = toInstanceId;
            task.connections[`${task.id}${SEP}${fromPath}`] = `${toId}${SEP}${toPath}`;
            utils.logTask(task, "CEPConnect from path", fromPath, "toId", toId, "toPath", toPath, "toInstanceId", toInstanceId);
            instancesToUpdate[task.instanceId] = task;
          } else {
            utils.logTask(task, `CEPConnect connectLater ${task.id}${SEP}${fromPath} ${toId}${SEP}${toPath}`);
            connectLater[`${task.id}${SEP}${fromPath}`] = `${toId}${SEP}${toPath}`;
            updateConnectLater = true;
          }
        }
      } else if (toId === task.id) {
        // Need to get the instanceId of from
        let connected = false;
        if (fromInstanceId) {
          // Get the current value
          const fromTask = await getActiveTask_async(fromInstanceId);
          if (fromTask.instanceId) {
            if (!fromTask?.connections?.IDMAP || !fromTask.connections.IDMAP[task.id]) {
              fromTask["connections"] =  fromTask.connections || {};
              fromTask.connections["IDMAP"] = fromTask.connections.IDMAP || {};
              fromTask.connections.IDMAP[task.id] = task.instanceId;
              fromTask.connections[`${fromTask.id}${SEP}${fromPath}`] = `${task.id}${SEP}${toPath}`;
              utils.logTask(task, "CEPConnect fromId", fromId, "path", fromPath, "toPath", toPath, "fromInstanceId", fromInstanceId);
              instancesToUpdate[fromTask.instanceId] = fromTask;
              connected = true;
            }
          }
        }
        if (!connected) {
          utils.logTask(task, `CEPConnect connectLater ${fromId}${SEP}${fromPath} ${task.id}${SEP}${toPath}`);
          connectLater[`${fromId}${SEP}${fromPath}`] = `${task.id}${SEP}${toPath}`;
          updateConnectLater = true;
        }
      }
    }

    if (updateConnectLater) {
      await connectionsStore_async.set(family, connectLater);
    }

    const promises = [];

    for (const instanceId of Object.keys(instancesToUpdate)) {
      let syncUpdateTask = {
        command: "update",
        commandArgs: {
          sync: true,
          instanceId: instanceId,
          syncTask: {
              connections: instancesToUpdate[instanceId].connections,
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

  // Update any connections
  if (modifiedOutput) {
    const T = utils.createTaskValueGetter(task);
    const taskConnections = utils.deepClone(task.connections) || {};
    let instancesToUpdate = {};
    for (const from of Object.keys(taskConnections)) {
      if (from === "IDMAP") continue;
      const fromSplit = from.split(SEP)
      const fromId = fromSplit[0];
      const fromPath = fromSplit[1];
      const to = taskConnections[from];
      const toSplit = to.split(SEP)
      const toId = toSplit[0];
      const toPath = toSplit[1];
      utils.logTask(task, "CEPConnect from ", from, "fromId", fromId, "fromPath", fromPath, "to", to, "toId", toId, "toPath", toPath, taskConnections);
      if ((from.startsWith(SEP) || fromId === task.id) && taskConnections.IDMAP[toId]) {
        const toTask = await getActiveTask_async(taskConnections.IDMAP[toId]);
        if (toTask && toTask.instanceId) {
          const Tto = utils.createTaskValueGetter(toTask);
          if (!utils.deepEqual(T(fromPath), Tto(toPath))) {
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