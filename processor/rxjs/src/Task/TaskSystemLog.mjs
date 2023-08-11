/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";
import { db } from "../storage.mjs";
import mongoose from 'mongoose';

// in the MongoDB object __v represents the version of the document

// Because any is defined as a Mixed type we need to use markModified
// If it has a schema then Mongoos can detect the change
const tasksSchema = new mongoose.Schema({
  _id: String,
  instanceId: String,
  current: mongoose.Mixed,
  updatedAt: {
    date: Date,
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
    let id = newTaskData.instanceId + newTaskData.meta.updatedAt.date + newTaskData.meta.updatedAt.timezone;
    if (newTaskData.type === "TaskSystemLog") {
      // we can get duplicate ids when this task is logging itself
      let currentDateTime = new Date();
      let currentDateTimeString = currentDateTime.toString();
      id = newTaskData.instanceId + currentDateTimeString;
    }
    // Fetch the existing task
    let task = await tasksModel.findOne({ 
      _id: id,
      updatedAt: newTaskData.meta.updatedAt  // Use updatedAt in the query
    });
    if (task) {
        task.current = stripTask(newTaskData);
        task.updatedAt = {
          date: newTaskData.meta.updatedAt.date,
          timezone: newTaskData.meta.updatedAt.timezone
        };
        task.instanceId = newTaskData.instanceId;
        task.markModified('current');
        task.markModified('updatedAt');
        await task.save();
    } else {
        // If the task does not exist, create a new one and save
        const newTask = new tasksModel({
            _id: id,
            current: stripTask(newTaskData),
            updatedAt: {
              date: newTaskData.meta.updatedAt.date,
              timezone: newTaskData.meta.updatedAt.timezone
            },
            instanceId: newTaskData.instanceId,
        });
        await newTask.save();
    }
  }

  async function fetchTasksAsync() {
    try {
      const tasks = await tasksModel.find({}).limit(10); // limiting during testing/debug
      return tasks;
    } catch (err) {
      console.error('Error fetching tasks:', err);
      return [];
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
      if (T("request.query") === "all") {
        T("response.tasks", await fetchTasksAsync());
        T("state.last", T("state.current"));
        T("state.current", "response");
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

