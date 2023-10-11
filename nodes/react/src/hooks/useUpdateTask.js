/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import { utils } from "../utils/utils.mjs";
import useWebSocketContext from "../contexts/WebSocketContext";

// We have: Start with startId, familyId
//          State with task
//          Task with task
// We should combine these

const useUpdateTask = (task, setTask) => {
  const { globalState } = useGlobalStateContext();
  const [updateTaskError, setUpdateTaskError] = useState();
  const { wsSendTask } = useWebSocketContext();

  useEffect(() => {
    const command = task?.command;
    const commandArgs = task?.commandArgs;
    const commandDescription = task?.commandDescription;
    // commandPending is used to wait for the response to a previous update before sending another update
    // without this the second update may be sent before the Hub returns the first update and then the storage value used for the diff 
    // would be out of sync with the storage on the hub (the hub will include the first update).
    const commandPending = task?.node?.commandPending;
    if (task && command === "update" && !updateTaskError && !commandPending) {
      utils.log("useUpdateTask", task.id, task);
      const fetchTaskFromAPI = async () => {
        try {
          let snapshot = utils.deepClone(task); // deep copy
          snapshot.node["commandPending"] = true;
          const updating = { "command": null, "commandArgs": null, "commandDescription": null, "node.commandPending": true };
          utils.setNestedProperties(updating);
          setTask((p) => utils.deepMerge(p, updating));
          if (commandArgs?.sync) {
            snapshot = {};
            snapshot["command"] = command;
            snapshot["commandArgs"] = commandArgs;
            snapshot["commandDescription"] = commandDescription;
            let instanceId = commandArgs.syncTask.instanceId || task.instanceId;
            snapshot["instanceId"] = instanceId;
            snapshot["meta"] = {};
            snapshot["node"] = {};
          }
          wsSendTask(snapshot);
        } catch (error) {
          //console.log(utils.findCyclicReference(task));
          console.log(error)
          setUpdateTaskError(error.message);
          setTask(null);
        }
      };
      fetchTaskFromAPI();
    }
  // eslint-disable-next-line
  }, [task]);

  return { updateTaskError };
};

export default useUpdateTask;
