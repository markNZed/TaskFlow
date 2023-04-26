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

const useTaskUpdate = (task, setTask, depth) => {
  
  const { globalState } = useGlobalStateContext();
  const [updateTaskLoading, setUpdateTaskLoading] = useState(true);
  const [updateTaskError, setUpdateTaskError] = useState(null);

  useEffect(() => {
    if (task?.update) {
      console.log("useTaskUpdate", task)
      const fetchTaskFromAPI = async () => {
        try {
          setUpdateTaskLoading(true);
          const result = await fetchData(globalState, { task: { ...task, component_depth: depth } });
          setTask((p) => { return {...p, ...result}})
          //setTask(result);
        } catch (error) {
          setUpdateTaskError(error.message);
          setTask(null);
        } finally {
          setUpdateTaskLoading(false);
        }
      };
      fetchTaskFromAPI();
      setTask((p) => { return {...p, update: false}})
    }
  }, [task, setTask]);

  return { updateTaskLoading, updateTaskError };
};

export default useTaskUpdate
