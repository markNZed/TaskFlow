/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";
import { tasksModel } from "./SchemaTasks.mjs"

// in the MongoDB object __v represents the version of the document

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
      break;
    default:
      console.log("WARNING unknown state : " + task.state.current);
      return null;
  }

  return task;
};

export { TaskSystemLog_async };
