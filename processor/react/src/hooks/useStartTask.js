/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect, useRef } from "react";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { log } from "../utils/utils";

const useStartTask = (startId, setStartId, familyId, stackPtr, prevInstanceId) => {
  const { globalState } = useGlobalStateContext();
  const [startTaskError, setTaskStartError] = useState();

  useEffect(() => {
    if (!startId || startTaskError) {
      return;
    }
    const fetchTaskFromAPI = async () => {
      try {
        const command = "start";
        const commandArgs = {prevInstanceId: prevInstanceId};
            log("useStartTask", startId, stackPtr);
        let task = { 
          id: startId,
          ...(stackPtr && { stackPtr: stackPtr }),
          ...(familyId && { familyId: familyId }),
          processor: {},
        };        
        fetchTask(globalState, command, commandArgs, task);
      } catch (error) {
        setTaskStartError(error.message);
      }
      // If start fails then we can try again for the same task if it is cleared
      setStartId(null);
    };

    fetchTaskFromAPI();
  // eslint-disable-next-line
  }, [startId]);

  return { startTaskError };
};

export default useStartTask;
