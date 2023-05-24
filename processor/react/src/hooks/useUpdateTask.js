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
//          Step with task
//          Task with task
// We should combine these

const useUpdateTask = (task, setTask, local_component_depth) => {
  const { globalState } = useGlobalStateContext();
  const [updateTaskLoading, setUpdateTaskLoading] = useState(false);
  const [updateTaskError, setUpdateTaskError] = useState();
  const { sendJsonMessagePlus } = useWebSocketContext();
  let snapshot = {}


  useEffect(() => {
    // This is executing twice
    if (
      task?.send &&
      !updateTaskLoading &&
      task.stackPtr === local_component_depth
    ) {
      log("useUpdateTask", task.id); // not logging
      console.log("useUpdateTask", task.id)
      const fetchTaskFromAPI = async () => {
        try {
          setUpdateTaskLoading(true);
          const snapshot = JSON.parse(JSON.stringify(task)); // deep copy
          const updating = { send: false, "response.updating": true };
          setNestedProperties(updating);
          setTask((p) => deepMerge(p, updating));
          // Here we could check if the websocket is already open
          if (globalState.sessionId) {
            sendJsonMessagePlus({"sessionId" : globalState.sessionId})
            console.log("Set sessionId ", globalState.sessionId);
          }
          // fetchTask can change some parmeters in Task and then we get conflicts (e.g. destination)
          const result = await fetchTask(globalState, "task/update", task);
          if (result === "synchronizing") {
            // Trying to move to websocket sync
            // Note we were setting result.response.updated = true; below
          } else {
            if (result.state.current !== task.state.current) {
              console.log("State has changed")
              result.state.deltaState = result.state.current
            } else {
              result.state.deltaState = ""; // We don't want to repeat the delta if it was not cleared before sending
            }
            // remove the destination so we don't get conflicts in checkConflicts
            delete result.destination
            delete result.newSource
            // The setTask prior to getting the result may not have taken effect so we set the result
            // otherwise send will be true and we will get a loop
            result.send = false;
            result.response.updating = false;
            log("useUpdateTask result", result);
            // If the task expects a websocket let's establish that
            if (globalState.sessionId) {
              sendJsonMessagePlus({"sessionId" : globalState.sessionId})
              console.log("Set sessionId ", globalState.sessionId);
            }
            // This version of task is not the latest, would need a ref to get this?
            const localChanges = getChanges(snapshot, task)
            log("localChanges", localChanges);
            const remoteChanges = getChanges(snapshot, result)
            log("remoteChanges", remoteChanges);
            checkConflicts(localChanges, remoteChanges)
            // With errors the same instance may not be returned
            result.response.updating = false;
            if (task.instanceId === result.instanceId) {
              result.response.updated = true;
              setTask((p) => deepMerge(p, result));
              // Keep local changes that happened during the update request
              setTask((p) => deepMerge(p, localChanges));
            } else {
              console.log("Received difference instanceId")
              setTask(result);
            }
          }
        } catch (error) {
          console.log(error)
          setUpdateTaskError(error.message);
          setTask(null);
        } finally {
          setUpdateTaskLoading(false);
        }
      };
      fetchTaskFromAPI();
    }
  // eslint-disable-next-line
  }, [task]);

  return { updateTaskLoading, updateTaskError };
};

export default useUpdateTask;
