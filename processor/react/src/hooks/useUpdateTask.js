/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import { useGlobalStateContext } from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { setNestedProperties, deepMerge, log, getChanges, checkConflicts } from "../utils/utils";
import { useWebSocketContext } from "../contexts/WebSocketContext";

// We have: Start with startId, threadId
//          State with task
//          Task with task
// We should combine these

const useUpdateTask = (task, setTask, local_component_depth) => {
  const { globalState } = useGlobalStateContext();
  const [updateTaskError, setUpdateTaskError] = useState();
  const { sendJsonMessagePlus } = useWebSocketContext();
  let snapshot = {}


  useEffect(() => {
    // This is executing twice
    if (task?.send && task.stackPtr === local_component_depth) {
      log("useUpdateTask", task.id); // not logging
      console.log("useUpdateTask", task.id)
      const fetchTaskFromAPI = async () => {
        try {
          const snapshot = JSON.parse(JSON.stringify(task)); // deep copy
          const updating = { send: false, "response.updating": true, "response.updated": false };
          setNestedProperties(updating);
          setTask((p) => deepMerge(p, updating));
          // The setTask prior to sending the result will not have taken effect
          // So we align the snapshot with the updated task and send that
          // otherwise send could come back treu and we will get a loop
          snapshot.response.updating = false;
          snapshot.send = false;
          // Here we could check if the websocket is already open
          if (globalState.sessionId) {
            sendJsonMessagePlus({"sessionId" : globalState.sessionId})
            console.log("Set sessionId ", globalState.sessionId);
          }
          // fetchTask can change some parameters in Task and then we get conflicts (e.g. destination)
          fetchTask(globalState, "task/update", snapshot);
          // Nothing useful is returned
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
