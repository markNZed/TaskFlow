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
    if (task && command === "update" && !updateTaskError) {
      utils.log("useUpdateTask", task.id, task);
      const fetchTaskFromAPI = async () => {
        try {
          let snapshot = utils.deepClone(task); // deep copy
          const updating = { "command": null, "commandArgs": null };
          utils.setNestedProperties(updating);
          setTask((p) => utils.deepMerge(p, updating));
          if (commandArgs?.sync) {
            snapshot = {};
            snapshot["command"] = command;
            snapshot["commandArgs"] = commandArgs;
            let instanceId = commandArgs.syncTask.instanceId || task.instanceId;
            snapshot["instanceId"] = instanceId;
            snapshot["meta"] = {};
            snapshot["processor"] = {};
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
