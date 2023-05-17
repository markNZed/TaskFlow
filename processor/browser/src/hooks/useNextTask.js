/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import { useGlobalStateContext } from "../contexts/GlobalStateContext";
import { fetchTask } from "../utils/fetchTask";
import { log } from "../utils/utils";
import { useWebSocketContext } from "../contexts/WebSocketContext";

// We have: Start with startId, threadId
//          Step with task
//          Task with task
// We should combine these

const useNextTask = (task) => {
  const { globalState } = useGlobalStateContext();
  const [nextTask, setNextTask] = useState();
  const [nextTaskLoading, setNextTaskLoading] = useState(false);
  const [nextTaskError, setNextTaskError] = useState(null);
  const { sendJsonMessagePlus } = useWebSocketContext();

  useEffect(() => {
    if (task && task.state.done && !nextTaskLoading) {
      log("useNextTask", task.id);
      const fetchTaskFromAPI = async () => {
        try {
          setNextTaskLoading(true);
          const result = await fetchTask(globalState, "task/update", task);
          // If the task expects a websocket let's establish that
          if (globalState.sessionId && result.websocket) {
            sendJsonMessagePlus({"sessionId" : globalState.sessionId})
            console.log("Set sessionId ", globalState.sessionId);
          }
          log("useNextTask result", result);
          setNextTask(result);
        } catch (error) {
          setNextTaskError(error.message);
          setNextTask(null);
        } finally {
          setNextTaskLoading(false);
        }
      };
      fetchTaskFromAPI();
    }
  // eslint-disable-next-line
  }, [task, setNextTask]);

  return { nextTask, nextTaskLoading, nextTaskError };
};

export default useNextTask;
