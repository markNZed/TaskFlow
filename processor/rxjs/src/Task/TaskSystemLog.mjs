/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "../utils.mjs";
import { CEPFunctions } from "../CEPFunctions.mjs";
import { tasksModel } from "./SchemaTasks.mjs"
import { coProcessor } from "../../config.mjs";

const TaskSystemLog_async = async function (taskName, wsSendTask, task, CEPFuncs) {

  const T = utils.createTaskValueGetter(task);
  utils.logTask(task, `${taskName} in state ${task?.state?.current}`);

  // Store a task in the DB
  // Could reduce storage usage by storing diffs but not worth the effort now
  async function updateTaskWithHistory(newTaskData) {
    // Could also append a random number but we do not expect multiple log events in the same millisecond
    // for the same task
    let currentDateTime = new Date();
    let timeInMilliseconds = currentDateTime.getTime();
    let id = newTaskData.instanceId + timeInMilliseconds;
    // We are recording a timeseries of each update so do not expect to find an existing entry
    // The start task does not have meta.updatedAt so we create a timestamp if it is missing
    let updatedAt = newTaskData.meta.updatedAt
    if (!updatedAt) {
      updatedAt = utils.updatedAt();
    }
    // If the task does not exist, create a new one and save
    const newTask = new tasksModel({
        _id: id,
        current: stripTask(newTaskData),
        updatedAt: updatedAt,
        instanceId: newTaskData.instanceId,
    });
    await newTask.save();
  }

  async function CEPLog(functionName, wsSendTask, CEPinstanceId, task, args) {
    // We do not want to log the TaskSystemLog or TaskSystemLogViewer because this is noise in debugging other tasks
    if (task.instanceId && task.type !== "TaskSystemLog" && task.type !== "TaskSystemLogViewer") {
      if (!coProcessor || task.processor.coProcessingDone ) {
        await updateTaskWithHistory(task);
      } else {
        utils.logTask(task, "Skipped logging because not coProcessingDone");
      }
    } else {
      // Should log even when there is no instanceId - not sure what to do for index in that case
      utils.logTask(task, "Skipped logging because no instanceId or TaskSystemLog");
    }
  }

  switch (task.state.current) {
    case "start":
      CEPFunctions.register("CEPLog", CEPLog);
      break;
    default:
      utils.logTask(task, "WARNING unknown state : " + task.state.current);
      return null;
  }

  return task;
};

// Task fields we do not want to store in the log 
function stripTask(task) {
  // deep copy
  const taskCopy = JSON.parse(JSON.stringify(task));
  // hashDiffOrigTask is for debug of the hash but it also helps spot what changes in the task
  //delete taskCopy.meta.hashDiffOrigTask; 
  delete taskCopy.meta.hashTask;
  delete taskCopy.processor.origTask;
  return taskCopy;
}

export { TaskSystemLog_async };

