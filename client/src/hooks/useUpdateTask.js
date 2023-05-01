/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from 'react';
import { useGlobalStateContext } from '../contexts/GlobalStateContext';
import { fetchTask } from '../utils/fetchTask'

// We have: Start with startId, threadId
//          Step with task
//          Task with task
// We should combine these

const useUpdateTask = (task, setTask, local_component_depth) => {
  
  const { globalState } = useGlobalStateContext();
  const [updateTaskLoading, setUpdateTaskLoading] = useState(true);
  const [updateTaskError, setUpdateTaskError] = useState(null);

  useEffect(() => {
    if (task?.update && !task?.updating && task.component_depth === local_component_depth) {
      //console.log("useUpdateTask", task)
      const fetchTaskFromAPI = async () => {
        try {
          setUpdateTaskLoading(true);
          setTask((p) => { return {...p, updated: false, updating: true}})
          //console.log("useUpdateTask before: ", task)
          const result = await fetchTask(globalState, 'task/update', task);
          setTask((p) => { return {...p, ...result, updated: true, update: false, updating: false}})
          //console.log("useUpdateTask after: ", result)
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
  }, [task]);

  return { updateTaskLoading, updateTaskError };
};

export default useUpdateTask
