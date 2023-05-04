/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import { useGlobalStateContext } from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { setNestedProperties, deepMerge, log } from "../utils/utils";

// We have: Start with startId, threadId
//          Step with task
//          Task with task
// We should combine these

const useNextTask = (task) => {
  const { globalState } = useGlobalStateContext();
  const [nextTask, setNextTask] = useState();
  const [nextTaskLoading, setNextTaskLoading] = useState(true);
  const [nextTaskError, setNextTaskError] = useState(null);

  useEffect(() => {
    if (task && task.state.done) {
      log("useNextTask", task.id);
      const fetchTaskFromAPI = async () => {
        try {
          setNextTaskLoading(true);
          const result = await fetchTask(globalState, "task/update", task);
          log("useNextTask result", task);
          setNextTask(result);
        } catch (error) {
          setNextTaskError(error.message);
          setNextTask(null);
        } finally {
          setNextTaskLoading(false);
        }
      };
      fetchTaskFromAPI();
      // Should not need this?
      //setNextTask((p) => { return {...p, update: false}})
    }
  }, [task, setNextTask]);

  return { nextTask, nextTaskLoading, nextTaskError };
};

export default useNextTask;
