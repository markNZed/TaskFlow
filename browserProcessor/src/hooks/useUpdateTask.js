/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import { useGlobalStateContext } from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { setNestedProperties, deepMerge, log, getChanges } from "../utils/utils";

// We have: Start with startId, threadId
//          Step with task
//          Task with task
// We should combine these

const useUpdateTask = (task, setTask, local_component_depth) => {
  const { globalState } = useGlobalStateContext();
  const [updateTaskLoading, setUpdateTaskLoading] = useState(false);
  const [updateTaskError, setUpdateTaskError] = useState();
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
          snapshot = task;
          const updating = { send: false, "response.updating": true };
          setNestedProperties(updating);
          setTask((p) => deepMerge(p, updating));
          const result = await fetchTask(globalState, "task/update", task);
          result.state.deltaState = result.state.current
          log("useUpdateTask result", result);
          const localChanges = getChanges(snapshot, task)
          log("localChanges", localChanges);
          // With errors the same instance may not be returned
          result.response.updating = false;
          if (task.instanceId === result.instanceId) {
            result.response.updated = true;
            setTask((p) => deepMerge(p, result));
            // Keep local changes that happened during the update request
            setTask((p) => deepMerge(p, localChanges));
          } else {
            setTask(result);
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
  }, [task]);

  return { updateTaskLoading, updateTaskError };
};

export default useUpdateTask;
