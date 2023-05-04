/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from 'react';
import { useGlobalStateContext } from '../contexts/GlobalStateContext';
import { fetchTask } from '../utils/fetchTask'
import { log } from '../utils/utils'

const useStartTask = (startId, threadId = null, component_depth = 0) => {

  const { globalState } = useGlobalStateContext();
  const [startTaskReturned, setStartTaskReturned] = useState();
  const [startTaskLoading, setStartTaskLoading] = useState(true);
  const [startTaskError, setTaskStartError] = useState();

  useEffect(() => {
    if (!startId) {return} 
    const fetchTaskFromAPI = async () => {
      try {
        setStartTaskLoading(true);
        log("useStartTask", startId)
        //console.log("Starting task ", startId, threadId, depth)
        let task = {id: startId, stackPtr: component_depth}
        if (threadId) { task['threadId'] = threadId }
        const result = await fetchTask(globalState, 'task/start', task);
        log("useStartTask result", task)
        //console.log("setStartTask result ", result)
        //console.log("component_depth ", depth)
        setStartTaskReturned(result);
      } catch (error) {
        setTaskStartError(error.message);
        setStartTaskReturned(null);
      } finally {
        setStartTaskLoading(false);
      }
    };

    fetchTaskFromAPI();

  }, [startId]);

  return { startTaskReturned, startTaskLoading, startTaskError };

};

export default useStartTask
