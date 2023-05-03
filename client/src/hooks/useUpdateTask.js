/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect } from 'react';
import { useGlobalStateContext } from '../contexts/GlobalStateContext';
import { fetchTask } from '../utils/fetchTask'
import { setNestedProperties, deepMerge, log } from '../utils/utils'


// We have: Start with startId, threadId
//          Step with task
//          Task with task
// We should combine these

const useUpdateTask = (task, setTask, local_component_depth) => {
  
  const { globalState } = useGlobalStateContext();
  const [updateTaskLoading, setUpdateTaskLoading] = useState(false);
  const [updateTaskError, setUpdateTaskError] = useState(null);

  useEffect(() => {
    // This is executing twice
    if (task?.v02?.meta?.send && !task?.v02?.request?.updating && task.v02.meta.stackPtr === local_component_depth) {
      log("useUpdateTask",task.v02.id)
      //console.log("useUpdateTask", task)
      const fetchTaskFromAPI = async () => {
        try {
          setUpdateTaskLoading(true)
          const updating = {'v02.meta.send': false, 'v02.response.updating': true, update: false, updating: true}
          setNestedProperties(updating)
          setTask(p => (deepMerge(p, updating)))
          //console.log("useUpdateTask before: ", updating)
          const result = await fetchTask(globalState, 'task/update', task);
          setTask(p => (deepMerge(p, result)))
          const updated = {'v02.response.updated': true, 'v02.response.updating': false, updated: true, updating: true}
          setNestedProperties(updated)
          setTask(p => (deepMerge(p, updated)))
        } catch (error) {
          setUpdateTaskError(error.message);
          setTask(null);
        } finally {
          setUpdateTaskLoading(false);
        }
      };
      fetchTaskFromAPI();
    }
  }, [task]);

  return { updateTaskLoading, updateTaskError };
};

export default useUpdateTask
