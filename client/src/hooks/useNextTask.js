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

const useNextTask = (task) => {
  
  const { globalState } = useGlobalStateContext();
  const [nextTask, setNextTask] = useState();
  const [nextTaskLoading, setNextTaskLoading] = useState(true);
  const [nextTaskError, setNextTaskError] = useState(null);

  useEffect(() => {
    if (task?.done) {
      //console.log("useNextTask", task)
      const fetchTaskFromAPI = async () => {
        try {
          setNextTaskLoading(true);
          const result = await fetchData(globalState, 'task/update', { task : task });
          setNextTask(result);
        } catch (error) {
          setNextTaskError(error.message);
          setNextTask(null);
        } finally {
          setNextTaskLoading(false);
        }
      };
      fetchTaskFromAPI();
      // Should not need this?
      //setNextTask((p) => { return {...p, update: false}})
    }
  }, [task, setNextTask]);

  return { nextTask, nextTaskLoading, nextTaskError };
};

export default useNextTask
