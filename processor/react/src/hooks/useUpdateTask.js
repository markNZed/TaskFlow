/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import { utils } from "../utils/utils";
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
          let snapshot = JSON.parse(JSON.stringify(task)); // deep copy
          const updating = { "command": null, "commandArgs": null };
          utils.setNestedProperties(updating);
          setTask((p) => utils.deepMerge(p, updating));
          wsSendTask(snapshot);
        } catch (error) {
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
