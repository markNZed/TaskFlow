/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import { useGlobalStateContext } from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { log } from "../utils/utils";

// We have: Start with startId, threadId
//          State with task
//          Task with task
// We should combine these

const useNextTask = (task) => {
  const { globalState } = useGlobalStateContext();
  const [nextTaskError, setNextTaskError] = useState(null);
  useEffect(() => {
    if (task && task.next && !nextTaskError) {
      log("useNextTask", task.id);
      const fetchTaskFromAPI = async () => {
        try {
          fetchTask(globalState, "task/update", task);
        } catch (error) {
          setNextTaskError(error.message);
        }
      };
      fetchTaskFromAPI();
    }
  // eslint-disable-next-line
  }, [task]);
  return { nextTaskError };
};

export default useNextTask;
