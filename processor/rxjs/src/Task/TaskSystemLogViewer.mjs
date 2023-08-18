/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { db } from "../storage.mjs";
import { parseFilter } from 'mongodb-query-parser';
import { tasksModel } from "./SchemaTasks.mjs"

// in the MongoDB object __v represents the version of the document

const TaskSystemLogViewer_async = async function (taskName, wsSendTask, task, CEPFuncs) {

  const T = utils.createTaskValueGetter(task);
  utils.logTask(task, `${taskName} in state ${task?.state?.current}`);

  async function fetchTasksAsync(query, sortCriteria, page = 1, limit = 100) {
    try {
      const parsedQuery = parseFilter(query);
      const skip = (page - 1) * limit;
      if (!sortCriteria || Object.keys(sortCriteria).length === 0) {
        sortCriteria = { "updatedAt.date": -1 }; // descending order
      }
      utils.logTask(task, "fetchTasksAsync", parsedQuery, sortCriteria, skip, limit);
      const tasks = await tasksModel.find(parsedQuery).sort(sortCriteria).skip(skip).limit(limit);
      const total = await tasksModel.countDocuments(parsedQuery);
      return { tasks, total };
    } catch (err) {
      console.error('Error fetching tasks:', err);
      return { tasks: [], total: 0 };
    }
  }

  switch (task.state.current) {
    case "start":
      T("state.last", T("state.current"));
      T("state.current", "query");
      break;
    case "query":
      utils.logTask(task, "State query with request.query", T("request.query"));
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
        // Only add to history if it is a new query
        const diff = utils.getObjectDifference(currentHistoryQuery, T("request.queryBuilder")) || {};
        if (Object.keys(diff).length > 0) {
          if (!queryHistory) {
            queryHistory = new Array(20).fill(null);
            queryHistoryPtr = 0;
          } else if (queryHistoryPtr >= 10) { // 10 entries in the circular buffer
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

