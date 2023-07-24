/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect, useRef } from "react";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { utils, setNestedProperties, log } from "../utils/utils";

const useStartTask = (task, setTask) => {
  const { globalState } = useGlobalStateContext();
  const [startTaskError, setStartTaskError] = useState();

  useEffect(() => {
    const command = task?.command;
    const commandArgs = task?.commandArgs;
    if (command !== "start" || startTaskError) {
      return;
    }
    const fetchTaskFromAPI = async () => {
      try {
        const initTask = {
          id: commandArgs.id,
          familyId: commandArgs?.familyId,
          processor: {},
        }
        let snapshot = JSON.parse(JSON.stringify(task)); // deep copy
        const updating = { "command": null, "commandArgs": null };
        setNestedProperties(updating);
        setTask((p) => utils.deepMerge(p, updating));
        snapshot = utils.deepMerge(snapshot, updating)
        log("useStartTask", snapshot.id);
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
