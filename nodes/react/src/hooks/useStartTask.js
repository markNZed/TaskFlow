/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect, useRef } from "react";
import { utils } from "../utils/utils.mjs";
import useWebSocketContext from "../contexts/WebSocketContext";

const useStartTask = (task, setTask, setStartTask) => {
  const { wsSendTask } = useWebSocketContext();
  const [startTaskError, setStartTaskError] = useState();
  const startTaskSentIdRef = useRef();

  useEffect(() => {
    const command = task?.command;
    const commandArgs = task?.commandArgs;
    if (command !== "start" || startTaskError) {
      return;
    }
    const fetchTaskFromAPI = async () => {
      try {
        setStartTask(null);
        let snapshot = utils.deepClone(task); // deep copy
        const updating = { command: null, commandArgs: null, commandDescription : null };
        utils.setNestedProperties(updating);
        setTask((p) => utils.deepMerge(p, updating));
        utils.log("useStartTask from ", snapshot.id, "launching", snapshot.commandArgs.id);
        wsSendTask(snapshot);
        startTaskSentIdRef.current = snapshot.commandArgs.id;
      } catch (error) {
        setStartTaskError(error.message);
        console.log("useStartTask error", error);
        startTaskSentIdRef.current = commandArgs.id;
      }
      console.log("useStartTask startTaskSentIdRef.current", startTaskSentIdRef.current);
    };

    fetchTaskFromAPI();
  // eslint-disable-next-line
  }, [task]);

  return { startTaskError, startTaskSentIdRef };
};

export default useStartTask;
