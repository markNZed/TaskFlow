/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { parseFilter } from 'mongodb-query-parser';
import { tasksModel } from "./SchemaTasks.mjs"

// in the MongoDB object __v represents the version of the document

const TaskSystemLogViewer_async = async function (taskName, wsSendTask, task, CEPFuncs) {

  const T = utils.createTaskValueGetter(task);
  utils.logTask(task, `${taskName} in state ${task?.state?.current}`);

  // Ftch tasks from the DB both sorted and paginated 
  async function fetchTasksAsync(query, sortCriteria, page = 1, limit = 100) {
    try {
      const parsedQuery = parseFilter(query);
      // Skip ahead to the page of results being requested
      const skip = (page - 1) * limit;
      // Defaul tsort criteria
      if (!sortCriteria || Object.keys(sortCriteria).length === 0) {
        sortCriteria = { "updatedAt.date": -1 }; // descending order
      }
      utils.logTask(task, "fetchTasksAsync", parsedQuery, sortCriteria, skip, limit);
      // Concurrent requests
      const tasksPromise = tasksModel.find(parsedQuery).sort(sortCriteria).skip(skip).limit(limit);
      const totalPromise = tasksModel.countDocuments(parsedQuery);
      const [tasks, total] = await Promise.all([tasksPromise, totalPromise]);
      return { tasks, total };
    } catch (err) {
      console.error('Error fetching tasks:', err);
      return { tasks: [], total: 0 };
    }
  }

  // State machine actions selected based on current state
  switch (task.state.current) {
    // On the React processor queries can be sent from the query state
    // here we transition to the query state that indicates this processor is ready
    case "start":
      T("state.last", T("state.current"));
      T("state.current", "query");
      break;
    // Process a query
    case "query":
      if (T("request.query")) {
        utils.logTask(task, "State query " + T("request.query") + " with request.page " + T("request.page"));
        const { tasks, total } = await fetchTasksAsync(T("request.query"), T("request.sortCriteria"), T("request.page"), T("request.limit"))
        utils.logTask(task, "Returned total", total);
        T("response.tasks", tasks);
        T("response.total", total);
        T("state.last", T("state.current"));
        T("state.current", "response");
        let queryHistory = T("state.queryHistory");
        let queryHistoryPtr = T("state.queryHistoryPtr");
        let currentHistoryQuery;
        if (queryHistory) {
          currentHistoryQuery = queryHistory[queryHistoryPtr]
        }
        // Only add to history if it is different from the previous query
        const diff = utils.getObjectDifference(currentHistoryQuery, T("request.queryBuilder")) || {};
        if (Object.keys(diff).length > 0) {
          if (!queryHistory) {
            // Create a circular buffer with 20 entries
            // We send a diff when updating tasks so a stack would require sending the entire stack with each update
            // A circular buffer will only send the new entry.
            queryHistory = new Array(20).fill(null);
            queryHistoryPtr = 0;
          } else if (queryHistoryPtr >= queryHistory.length) {
            queryHistoryPtr = 0;
          } else {
            queryHistoryPtr++;
          }
          queryHistory[queryHistoryPtr] = T("request.queryBuilder");
          T("state.queryHistory", queryHistory);
          T("state.queryHistoryPtr", queryHistoryPtr);
        }
        T("command", "update");
      }
      break;
    case "response":
      break;
    default:
      utils.logTask(task, "WARNING unknown state : " + task.state.current);
      return null;
  }

  return task;
};

export { TaskSystemLogViewer_async };

