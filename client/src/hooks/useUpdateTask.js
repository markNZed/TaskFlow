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

const useUpdateTask = (task, setTask, depth) => {
  
  const { globalState } = useGlobalStateContext();
  const [updateTaskLoading, setUpdateTaskLoading] = useState(true);
  const [updateTaskError, setUpdateTaskError] = useState(null);

  useEffect(() => {
    if (task?.update && !task?.updating) {
      //console.log("useUpdateTask", task)
      const fetchTaskFromAPI = async () => {
        try {
          setUpdateTaskLoading(true);
          setTask((p) => { return {...p, updated: false, updating: true}})
          const result = await fetchData(globalState, 'task/update', { task: { ...task, component_depth: depth } });
          setTask((p) => { return {...p, ...result, updated: true, update: false, updating: false}})
          //setTask(result);
        } catch (error) {
          setUpdateTaskError(error.message);
          setTask(null);
        } finally {
          setUpdateTaskLoading(false);
        }
      };
      fetchTaskFromAPI();
      //setTask((p) => { return {...p, update: false}})
    }
  }, [task, setTask]);

  return { updateTaskLoading, updateTaskError };
};

export default useUpdateTask
