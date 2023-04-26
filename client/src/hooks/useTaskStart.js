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

const useTaskStart = (setTask, startId, threadId = null) => {

  const { globalState } = useGlobalStateContext();
  const [startTaskLoading, setStartTaskLoading] = useState(true);
  const [startTaskError, setTaskStartError] = useState(null);

  useEffect(() => {
    if (!startId) {return} 
    const fetchTaskFromAPI = async () => {
      try {
        setStartTaskLoading(true);
        const result = await fetchData(globalState, { startId: startId, threadId: threadId});
        setTask(result);
      } catch (error) {
        setTaskStartError(error.message);
        setTask(null);
      } finally {
        setStartTaskLoading(false);
      }
    };

    fetchTaskFromAPI();

  }, [startId]);

  return { startTaskLoading, startTaskError };

};

export default useTaskStart
