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

const useTaskUpdate = (task, setTask) => {
  
  const { globalState } = useGlobalStateContext();
  const [taskLoading, setTaskLoading] = useState(true);
  const [taskError, setTaskError] = useState(null);

  useEffect(() => {
    if (task?.update) {
      const fetchTaskFromAPI = async () => {
        try {
          setTaskLoading(true);
          const result = await fetchData(globalState, { task: task});
          setTask((p) => { return {...p, ...result}})
          //setTask(result);
        } catch (error) {
          setTaskError(error.message);
          setTask(null);
        } finally {
          setTaskLoading(false);
        }
      };
      fetchTaskFromAPI();
      setTask((p) => { return {...p, update: false}})
    }
  }, [task, setTask]);

  return { taskLoading, taskError };
};

export default useTaskUpdate
