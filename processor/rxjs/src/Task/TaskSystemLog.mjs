/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";
import { db } from "../storage.mjs";
import mongoose from 'mongoose';
import { parseFilter } from 'mongodb-query-parser';

// in the MongoDB object __v represents the version of the document

// Because any is defined as a Mixed type we need to use markModified
// If it has a schema then Mongoos can detect the change
const tasksSchema = new mongoose.Schema({
  _id: String,
  instanceId: String,
  current: mongoose.Schema.Types.Mixed,
  updatedAt: {
    date: {type: Date, index: true},
    timezone: String
  },
});

// Mongoose should create a collecton "tasks" in the database "taskflow"
const tasksModel = db.model('tasks', tasksSchema);

function stripTask(task) {
  // deep copy
  const taskCopy = JSON.parse(JSON.stringify(task));
  // There are many fields we do not want to store in the log 
  delete taskCopy.meta.hashDiffOrigTask;
  delete taskCopy.meta.hashTask;
  delete taskCopy.processor.origTask;
  if (taskCopy.type === "TaskSystemLog") {
    delete taskCopy.response.tasks;
  }
  return taskCopy;
}

const TaskSystemLog_async = async function (taskName, wsSendTask, task, CEPFuncs) {

  const T = utils.createTaskValueGetter(task);
  console.log(`${taskName} in state ${task?.state?.current}`);

  // We really only need to store diffs
  async function updateTaskWithHistory(newTaskData) {
    // Could use a random number ?
    let currentDateTime = new Date();
    let timeInMilliseconds = currentDateTime.getTime();
    let id = newTaskData.instanceId + timeInMilliseconds;
    // Fetch the existing task
    let task = await tasksModel.findOne({ 
      _id: id,
      updatedAt: newTaskData.meta.updatedAt  // Use updatedAt in the query
    });
    // The start task may not have meta.updatedAt
    let updatedAt;
    if (newTaskData.meta.updatedAt) {
      updatedAt = {
        date: newTaskData.meta.updatedAt.date,
        timezone: newTaskData.meta.updatedAt.timezone
      }
    } else {
      updatedAt = utils.updatedAt();
    }
    if (task) {
        task.current = stripTask(newTaskData);
        task.updatedAt = updatedAt;
        task.instanceId = newTaskData.instanceId;
        task.markModified('current');
        task.markModified('updatedAt');
        await task.save();
    } else {
        // If the task does not exist, create a new one and save
        const newTask = new tasksModel({
            _id: id,
            current: stripTask(newTaskData),
            updatedAt: updatedAt,
            instanceId: newTaskData.instanceId,
        });
        await newTask.save();
    }
  }

  async function fetchTasksAsync(query, sortCriteria, page = 1, limit = 100) {
    try {
      const parsedQuery = parseFilter(query);
      const skip = (page - 1) * limit;
      if (!sortCriteria || Object.keys(sortCriteria).length === 0) {
        sortCriteria = { "updatedAt.date": -1 }; // descending order
      }
      console.log("fetchTasksAsync", parsedQuery, sortCriteria, skip, limit);
      const tasks = await tasksModel.find(parsedQuery).sort(sortCriteria).skip(skip).limit(limit);
      const total = await tasksModel.countDocuments(parsedQuery);
      return { tasks, total };
    } catch (err) {
      console.error('Error fetching tasks:', err);
      return { tasks: [], total: 0 };
    }
  }

  async function CEPLog(functionName, wsSendTask, task, CEPtask, args) {
    console.log("CEPLog updateOne", CEPtask.id, CEPtask.instanceId);
    if (CEPtask.instanceId) {
      await updateTaskWithHistory(CEPtask);
    } else {
      // Should log even when there is no instanceId - not sure what to do for index in that case
      console.log("Skipped logging because no instanceId");
    }
  }

  switch (task.state.current) {
    case "start":
      CEPFunctions.register("CEPLog", CEPLog);
      T("state.last", T("state.current"));
      T("state.current", "query");
      break;
    case "query":
      console.log("State query with request.query", T("request.query"));
      if (T("request.query")) {
        console.log("State query " + T("request.query") + " with request.page " + T("request.page"));
        const { tasks, total } = await fetchTasksAsync(T("request.query"), T("request.sortCriteria"), T("request.page"), T("request.limit"))
        console.log("Returned total", total);
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
      console.log("WARNING unknown state : " + task.state.current);
      return null;
  }

  return task;
};

export { TaskSystemLog_async };

