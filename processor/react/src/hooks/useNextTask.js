/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { setNestedProperties, deepMerge, log } from "../utils/utils";

// We have: Start with startId, familyId
//          State with task
//          Task with task
// We should combine these

const useNextTask = (task, setTask) => {
  const { globalState } = useGlobalStateContext();
  const [nextTaskError, setNextTaskError] = useState(null);
  useEffect(() => {
    const command = task?.command;
    const commandArgs = task?.commandArgs;
    if (task && command === "next" && !nextTaskError) {
      log("useNextTask", task.id);
      let snapshot = JSON.parse(JSON.stringify(task)); // deep copy
      const updating = { "command": null, "commandArgs": null };
      setNestedProperties(updating);
      setTask((p) => deepMerge(p, updating));
      // The setTask prior to sending the result will not have taken effect
      // So we align the snapshot with the updated task and send that
      snapshot = deepMerge(snapshot, updating)
      const fetchTaskFromAPI = async () => {
        try {
          fetchTask(globalState, command, commandArgs, snapshot);
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
