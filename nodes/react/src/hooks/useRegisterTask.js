/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from "react";
import { utils } from "../utils/utils.mjs";
import useWebSocketContext from "../contexts/WebSocketContext";

const useRegisterTask = (task, setTask) => {
  const { wsSendTask } = useWebSocketContext();
  const [registerTaskError, setRegisterTaskError] = useState();

  useEffect(() => {
    const command = task?.command;
    if (command !== "register" || registerTaskError) {
      return;
    }
    const fetchTaskFromAPI = async () => {
      try {
        let snapshot = utils.deepClone(task); // deep copy
        const updating = { command: null, commandArgs: null, commandDescription : null };
        utils.setNestedProperties(updating);
        setTask((p) => utils.deepMerge(p, updating));
        utils.log("useRegisterTask task ", task);
        wsSendTask(snapshot);
      } catch (error) {
        console.log(error)
        setRegisterTaskError(error.message);
      }
    };

    fetchTaskFromAPI();
  // eslint-disable-next-line
  }, [task]);

  return { registerTaskError };
};

export default useRegisterTask;
