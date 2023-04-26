/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from 'react';
import { useGlobalStateContext } from '../contexts/GlobalStateContext';
import { fetchData } from '../utils/fetchData'

// We have: Start with startId, threadId
//          Step with task
//          Task with task
// We should combine these

const useTaskStart = (startId, threadId = null) => {

  const { globalState } = useGlobalStateContext();
  const [startTask, setStartTask] = useState();
  const [startTaskLoading, setStartTaskLoading] = useState(true);
  const [startTaskError, setTaskStartError] = useState();

  useEffect(() => {
    if (!startId) {return} 
    const fetchTaskFromAPI = async () => {
      try {
        setStartTaskLoading(true);
        const result = await fetchData(globalState, 'task/start', { startId: startId, threadId: threadId});
        console.log("setStartTask result ", result)
        setStartTask(result);
      } catch (error) {
        setTaskStartError(error.message);
        setStartTask(null);
      } finally {
        setStartTaskLoading(false);
      }
    };

    fetchTaskFromAPI();

  }, [startId]);

  return { startTask, startTaskLoading, startTaskError };

};

export default useTaskStart
