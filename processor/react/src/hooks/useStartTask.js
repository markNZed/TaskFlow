/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect, useRef } from "react";
import { useGlobalStateContext } from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { log } from "../utils/utils";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { openStorage } from "../storage.js";

const useStartTask = (startId, threadId = null, component_depth = 0) => {
  const { globalState } = useGlobalStateContext();
  const [startTaskReturned, setStartTaskReturned] = useState();
  const [startTaskLoading, setStartTaskLoading] = useState(true);
  const [startTaskError, setTaskStartError] = useState();
  const { sendJsonMessagePlus } = useWebSocketContext();
  const storageRef = useRef(null);

  useEffect(() => {
    const initializeStorage = async () => {
      const storageInstance = await openStorage();
      storageRef.current = storageInstance;
    };

    initializeStorage();
  }, []);


  useEffect(() => {
    if (!startId) {
      return;
    }
    const fetchTaskFromAPI = async () => {
      try {
        setStartTaskLoading(true);
        log("useStartTask", startId);
        //console.log("Starting task ", startId, threadId, depth)
        let task = { id: startId, stackPtr: component_depth };
        if (threadId) {
          task["threadId"] = threadId;
        }
        const result = await fetchTask(globalState, "task/start", task);
        console.log("useStartTask result ", result)
        //console.log("component_depth ", depth)
        setStartTaskReturned(result);
        // We are not using this storage yet
        // We will need to clean it up
        storageRef.current.set(result.instanceId, result);
        const value = await storageRef.current.get("a1");
        console.log("storage testing ", value);
        // If the task expects a websocket let's establish that
        if (globalState.sessionId && result.websocket) {
          sendJsonMessagePlus({"sessionId" : globalState.sessionId})
          console.log("Set sessionId ", globalState.sessionId);
        }
      } catch (error) {
        setTaskStartError(error.message);
        setStartTaskReturned(null);
      } finally {
        setStartTaskLoading(false);
      }
    };

    fetchTaskFromAPI();
  // eslint-disable-next-line
  }, [startId]);

  return { startTaskReturned, startTaskLoading, startTaskError };
};

export default useStartTask;
