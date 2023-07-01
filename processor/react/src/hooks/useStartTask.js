/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect, useRef } from "react";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { setNestedProperties, deepMerge, log } from "../utils/utils";

const useStartTask = (task, setTask, local_stackPtr) => {
  const { globalState } = useGlobalStateContext();
  const [startTaskError, setStartTaskError] = useState();

  useEffect(() => {
    const command = task?.command;
    const commandArgs = task?.commandArgs;
    if (command !== "start" || startTaskError || task.stackPtr !== local_stackPtr) {
      return;
    }
    const fetchTaskFromAPI = async () => {
      try {
        const initTask = {
          id: commandArgs.id,
          stackPtr: commandArgs.stackPtr,
          familyId: commandArgs?.familyId,
          processor: {},
        }
        let snapshot = JSON.parse(JSON.stringify(initTask)); // deep copy
        const updating = { "command": null, "commandArgs": null };
        setNestedProperties(updating);
        setTask((p) => deepMerge(p, updating));
        snapshot = deepMerge(snapshot, updating)
        log("useStartTask", snapshot.id, snapshot.stackPtr);
        fetchTask(globalState, command, commandArgs, snapshot);
      } catch (error) {
        console.log(error)
        setStartTaskError(error.message);
      }
    };

    fetchTaskFromAPI();
  // eslint-disable-next-line
  }, [task]);

  return { startTaskError };
};

export default useStartTask;
