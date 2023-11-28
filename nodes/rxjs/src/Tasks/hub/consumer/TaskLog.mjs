/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { parseFilter } from 'mongodb-query-parser';
import { tasksModel, collection } from "#src/CEPs/CEPSystemLogger/tasksModel"
import { formatQuery } from 'react-querybuilder';
import { outputStore_async } from "#src/storage";
import natural from 'natural'; // a popular NLP toolkit for Node.js

// TfIdf stands for Term Frequency-Inverse Document Frequency, a common weighting scheme in text mining.
// It's used for evaluating how important a word is to a document in a collection or corpus.
const TfIdf = natural.TfIdf;
// This tokenizer splits a given text into an array of words.
// It's useful for breaking down text into manageable units for NLP tasks.
const tokenizer = new natural.WordTokenizer();

/*
  We assume we are fetching task information from mongoDB

  topTerms could be added to the DB effectively caching this
*/

// eslint-disable-next-line no-unused-vars
const TaskLog_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

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

  /*
    Concatenates all leaf-level string values in a nested object into a single string.
    The function recursively traverses the object. If a property is a string, it first 
    filters the string to ensure it only contains words, then adds it to the result. 
    If a property is an object (and not null), the function calls itself recursively on 
    that object. Non-word strings are filtered out, and words are separated by spaces 
    in the final result string.
    @param {object} obj - The object to be traversed.
    @returns {string} A concatenated string of all leaf-level string words in the object.
   */
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
  async function fetchTasksAsync(queryBuilder, sortColumns, page = 1, pageSize, addTopTerms) {
    try {
      let mongoQuery;
      let parsedQuery = {};
      if (queryBuilder && Object.keys(queryBuilder).length > 0) {
        mongoQuery = formatQuery(queryBuilder, 'mongodb');
        parsedQuery = parseFilter(mongoQuery);
      }
      let sortCriteria;
      if (sortColumns) {
        sortCriteria = transformToMongoSortCriteria(sortColumns);
      }
      // Skip ahead to the page of results being requested
      const skip = (page - 1) * pageSize;
      // Default sort criteria
      if (!sortCriteria || Object.keys(sortCriteria).length === 0) {
        sortCriteria = { "updatedAt.date": -1 }; // descending order
      }
      utils.logTask(T(), "fetchTasksAsync", parsedQuery, sortCriteria, skip, pageSize);
      // .lean() returns a plain Javascript object without metadata
      // Different modes which determine how we modify the query (or not)
      let modeQuery;
      let taskEntries;
      let total;
      let directQuery = false;
      const mode = T("config.local.mode");
      if (mode) { 
        switch (mode) {
          case "selectFounder":
            // If no current.state.stable in the family then ignore ?
            modeQuery = { ...parsedQuery, 
              'current.user.id': T("user.id"),
              'current.node.command': 'init',
              'current.meta.founder': true,
              'current.id': { $not: /^root\.system\./ },
              'current.type': { $ne: 'TaskLog' },
            };
            break;
          case "selectState": {
            modeQuery = {
              'current.familyId': T("input.cloneFamilyId"),
              '$or': [
                { 'current.meta.founder': true },
                { 
                  '$expr': { 
                    '$and': [ 
                      { '$isArray': '$current.state.stable' },
                      { '$in': ['$current.state.current', '$current.state.stable'] }
                    ]
                  }
                }
              ]
            };
            // Because of limitation in Mongoose I needed to connect directly to MongoDB
            // The issue is related with the $in operator and $current.state.stable is not always an array
            taskEntries = await collection.find(modeQuery).sort(sortCriteria).skip(skip).limit(pageSize).toArray();
            total = await collection.countDocuments(modeQuery);
            directQuery = true;
            break;
          }
          default:
            modeQuery = parsedQuery;
        }
      } else {
         modeQuery = parsedQuery;
      }
      utils.logTask(T(), "modeQuery", modeQuery);
      if (!directQuery) {
        const taskEntriesPromise = tasksModel.find(modeQuery).sort(sortCriteria).skip(skip).limit(pageSize).lean();
        const totalPromise = tasksModel.countDocuments(modeQuery);
        // Concurrent requests
        [taskEntries, total] = await Promise.all([taskEntriesPromise, totalPromise]);
      }
      if (addTopTerms) {
        // For each task get the familyId, fetch the outputs, run keyword extraction
        for (let taskEntry of taskEntries) {
          const task = taskEntry.current;
          const outputs = await outputStore_async.get(task.familyId);
          //console.log("fetchTasksAsync outputs", task.familyId, utils.js(outputs));
          const concatenatedString = concatenateLeafStrings(outputs);
          //console.log("fetchTasksAsync concatenatedString", task.familyId, utils.js(concatenatedString));
          const tfidf = new TfIdf();
          tfidf.addDocument(concatenatedString);
          // Extract top 6 terms
          const topTerms = tfidf.listTerms(0 /* document index */)
                                .slice(0, 6) // Get only the top 6 terms
                                .map(term => term.term);
          taskEntry["topTerms"] = topTerms;
          //console.log('topTerms:', topTerms.join(', '));
        }
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
    case "query": {
      let requestQueryBuilder = T("request.queryBuilder");
      if (T("request.mode")) {
        utils.logTask(T(), "Request mode", T("request.mode"));
        T("config.local.mode", T("request.mode")); // Should not be able to update config on React side I guess
      }
      if (requestQueryBuilder && Object.keys(requestQueryBuilder).length > 0 && T("config.local.mode") === "selectState") {
        utils.logTask(T(), "Received query while in mode selectState so switching to mode selectFounder");
        T("config.local.mode", "selectFounder");
      }
      if (T("config.local.autoQuery") && !T("state.autoQuery")) {
        T("state.autoQuery", true);
        requestQueryBuilder = {};
      }
      if (requestQueryBuilder) {
        const pageSize = T("request.pageSize") || T("config.local.pageSize");
        const page = T("request.page") || 1;
        const addTopTerms = T("config.local.addTopTerms");
        utils.logTask(T(), "State query ", requestQueryBuilder, " with request.page", T("request.page"));
        const { taskEntries, total } = await fetchTasksAsync(requestQueryBuilder, T("request.sortColumns"), page, pageSize, addTopTerms)
        utils.logTask(T(), "Returned total", total);
        T("response.tasks", taskEntries);
        T("response.total", total);
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
            // A circular buffer will only send the new entry with each differential update
            queryHistory = new Array(20).fill(null);
            queryHistoryPtr = 0;
          } else if (queryHistoryPtr >= queryHistory.length) {
            queryHistoryPtr = 0;
          } else {
            queryHistoryPtr++;
          }
          queryHistory[queryHistoryPtr] = utils.deepClone(T("request.queryBuilder"));
          T("state.queryHistory", queryHistory);
          T("state.queryHistoryPtr", queryHistoryPtr);
        }
        T("state.current", "response");
        T("command", "update");
        T("commandDescription", `Update the response with query results and the state.queryHistory with ${total} results.`);
      } else {
        utils.logTask(T(), "Query without request.queryBuilder");
      }
      break;
    }
    case "response":
      break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskLog_async };

