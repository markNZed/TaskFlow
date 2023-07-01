/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect, useRef } from "react";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { log } from "../utils/utils";

const useStartTask = (initTask, setInitTask) => {
  const { globalState } = useGlobalStateContext();
  const [startTaskError, setTaskStartError] = useState();

  useEffect(() => {
    if (!initTask?.id || startTaskError) {
      return;
    }
    const fetchTaskFromAPI = async () => {
      try {
        let snapshot = JSON.parse(JSON.stringify(initTask)); // deep copy
        const command = "start";
        const commandArgs = {prevInstanceId: initTask.commandArgs?.prevInstanceId};
        log("useStartTask", snapshot.id, snapshot.stackPtr);
        snapshot["processor"] = {};    
        fetchTask(globalState, command, commandArgs, snapshot);
      } catch (error) {
        setTaskStartError(error.message);
      }
      // If start fails then we can try again for the same task if it is cleared
      setInitTask(null);
    };

    fetchTaskFromAPI();
  // eslint-disable-next-line
  }, [initTask]);

  return { startTaskError };
};

export default useStartTask;
