/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { parseFilter } from 'mongodb-query-parser';
import { tasksModel } from "./TaskCEPSystemLog/tasksModel.mjs"
import { formatQuery } from 'react-querybuilder';

// eslint-disable-next-line no-unused-vars
const TaskSystemLogViewer_async = async function (wsSendTask, T, fsmHolder, CEPFuncs, services) {

  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  function transformToMongoSortCriteria(sortDescriptors) {
    const mongoSortCriteria = {};
    if (sortDescriptors) {
      sortDescriptors.forEach(descriptor => {
          const direction = (descriptor.direction === 'ASC') ? 1 : -1;
          mongoSortCriteria[descriptor.columnKey] = direction;
      });
    }
    return mongoSortCriteria;
  }

  // Fetch tasks from the DB both sorted and paginated 
  async function fetchTasksAsync(queryBuilder, sortColumns, page = 1, pageSize) {
    try {
      const mongoQuery = formatQuery(queryBuilder, 'mongodb');
      const parsedQuery = parseFilter(mongoQuery);
      let sortCriteria = transformToMongoSortCriteria(sortColumns);
      // Skip ahead to the page of results being requested
      const skip = (page - 1) * pageSize;
      // Defaul tsort criteria
      if (!sortCriteria || Object.keys(sortCriteria).length === 0) {
        sortCriteria = { "updatedAt.date": -1 }; // descending order
      }
      utils.logTask(T(), "fetchTasksAsync", parsedQuery, sortCriteria, skip, pageSize);
      // Concurrent requests
      const tasksPromise = tasksModel.find(parsedQuery).sort(sortCriteria).skip(skip).limit(pageSize);
      const totalPromise = tasksModel.countDocuments(parsedQuery);
      const [tasks, total] = await Promise.all([tasksPromise, totalPromise]);
      return { tasks, total };
    } catch (err) {
      console.error('Error fetching tasks:', err);
      return { tasks: [], total: 0 };
    }
  }

  // State machine actions selected based on current state
  switch (T("state.current")) {
    // On the React processor queries can be sent from the query state
    // here we transition to the query state that indicates this processor is ready
    case "start":
      T("state.current", "query");
      break;
    // Process a query
    case "query":
      if (T("request.queryBuilder")) {
        utils.logTask(T(), "State query " + T("request.queryBuilder") + " with request.page " + T("request.page"));
        const { tasks, total } = await fetchTasksAsync(T("request.queryBuilder"), T("request.sortColumns"), T("request.page"), T("request.pageSize"))
        utils.logTask(T(), "Returned total", total);
        T("response.tasks", tasks);
        T("response.total", total);
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
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemLogViewer_async };

