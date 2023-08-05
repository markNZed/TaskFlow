/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect, useRef } from "react";
import { utils } from "../utils/utils";
import useWebSocketContext from "../contexts/WebSocketContext";

const useStartTask = (task, setTask) => {
  const { wsSendTask } = useWebSocketContext();
  const [startTaskError, setStartTaskError] = useState();

  useEffect(() => {
    const command = task?.command;
    if (command !== "start" || startTaskError) {
      return;
    }
    const fetchTaskFromAPI = async () => {
      try {
        let snapshot = JSON.parse(JSON.stringify(task)); // deep copy
        const updating = { "command": null, "commandArgs": null };
        utils.setNestedProperties(updating);
        setTask((p) => utils.deepMerge(p, updating));
        utils.log("useStartTask", snapshot.id);
        wsSendTask(snapshot);
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
