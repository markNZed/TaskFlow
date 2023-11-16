/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { parseFilter } from 'mongodb-query-parser';
import { tasksModel } from "#src/CEPs/CEPSystemLog/tasksModel"
import { formatQuery } from 'react-querybuilder';
import { outputStore_async } from "#src/storage";
import natural from 'natural';

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

// eslint-disable-next-line no-unused-vars
const TaskMy_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

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

  function filterNonWords(str) {
    const tokens = tokenizer.tokenize(str);
    const wordRegex = /^[A-Za-z]+$/; // Regular expression to match words
    const words = tokens.filter(token => wordRegex.test(token));
    return words.join(' ');
  }

  function concatenateLeafStrings(obj) {
    let result = '';
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
          const words = filterNonWords(obj[key]);
          // Use a regular expression to test if the string is a word
          if (words) {
            result += words + ' '; // Added a space for separation
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // If the property is an object, recurse
            result += concatenateLeafStrings(obj[key]);
        }
    }
    return result;
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
      // .lean() returns a plain Javascript object without metadata
      const userQuery = { ...parsedQuery, 
        'current.user.id': T("user.id"),
        'current.node.command': 'init',
        'current.meta.founder': true,
        'current.id': { $not: /^root\.system\./ },
        'current.type': { $ne: 'TaskMy' },
      };
      const taskEntriesPromise = tasksModel.find(userQuery).sort(sortCriteria).skip(skip).limit(pageSize).lean();
      const totalPromise = tasksModel.countDocuments(parsedQuery);
      const [taskEntries, total] = await Promise.all([taskEntriesPromise, totalPromise]);
      // For each task get the familyId, fetch the outputs, run keyword extraction
      for (let taskEntry of taskEntries) {
        const task = taskEntry.current;
        const outputs = await outputStore_async.get(task.familyId);
        console.log("fetchTasksAsync outputs", task.familyId, utils.js(outputs));
        const concatenatedString = concatenateLeafStrings(outputs);
        console.log("fetchTasksAsync concatenatedString", task.familyId, utils.js(concatenatedString));
        const tfidf = new TfIdf();
        tfidf.addDocument(concatenatedString);
        // Extract top 6 terms
        const topTerms = tfidf.listTerms(0 /* document index */)
                               .slice(0, 6) // Get only the top 6 terms
                               .map(term => term.term);
        taskEntry["topTerms"] = topTerms;
        console.log('topTerms:', topTerms.join(', '));
      }

      return { taskEntries, total };
    } catch (err) {
      console.error('Error fetching tasks:', err);
      return { taskEntries: [], total: 0 };
    }
  }

  // State machine actions selected based on current state
  switch (T("state.current")) {
    // On the React node queries can be sent from the query state
    // here we transition to the query state that indicates this node is ready
    case "start":
      T("state.current", "query");
      T("command", "update");
      break;
    // Process a query
    case "query":
      if (T("request.queryBuilder")) {
        utils.logTask(T(), "State query ", T("request.queryBuilder"), " with request.page", T("request.page"));
        const { taskEntries, total } = await fetchTasksAsync(T("request.queryBuilder"), T("request.sortColumns"), T("request.page"), T("request.pageSize"))
        utils.logTask(T(), "Returned total", total);
        T("response.tasks", taskEntries);
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
        T("commandDescription", `Update the response with query results and the state.queryHistory with ${total} results.`);
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

export { TaskMy_async };

