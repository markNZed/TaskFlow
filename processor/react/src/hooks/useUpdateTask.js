/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { setNestedProperties, deepMerge, log } from "../utils/utils";
import useWebSocketContext from "../contexts/WebSocketContext";

// We have: Start with startId, familyId
//          State with task
//          Task with task
// We should combine these

const useUpdateTask = (task, setTask, local_stackPtr) => {
  const { globalState } = useGlobalStateContext();
  const [updateTaskError, setUpdateTaskError] = useState();
  const { sendJsonMessagePlus } = useWebSocketContext();

  useEffect(() => {
    const command = task?.command;
    const commandArgs = task?.commandArgs;
    if (task && command === "update" && task.stackPtr === local_stackPtr && !updateTaskError) {
      log("useUpdateTask", task.id, task);
      const fetchTaskFromAPI = async () => {
        try {
          let snapshot = JSON.parse(JSON.stringify(task)); // deep copy
          const updating = { "command": null, "commandArgs": null, "response.updating": true };
          setNestedProperties(updating);
          setTask((p) => deepMerge(p, updating));
          // The setTask prior to sending the result will not have taken effect
          // So we align the snapshot with the updated task and send that
          // otherwise send could come back true and we will get a loop
          snapshot = deepMerge(snapshot, updating)
          // fetchTask can change some parameters in Task 
          // so we save the task object after those changes in the fetchTask
          await fetchTask(globalState, command, commandArgs, snapshot);
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
