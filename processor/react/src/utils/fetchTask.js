import { hubUrl } from "../config";
import { toTask, fromTask } from "./taskConverterWrapper";
import { utils } from "./utils";

export const fetchTask = async (globalState, command, commandArgs, task) => {

  let messageJsonString;

  const processorId = globalState.processorId;

  // Initialize processor when it does not exist e.g. when starting initial task
  if (!task.processor) {
    task.processor = {};
  }
  // Clear down task commands as we do not want these coming back from the hub
  task.processor["command"] = command;
  task.processor["commandArgs"] = commandArgs;
  task.processor["id"] = processorId;

  // Only intended for update command
  const origTask = task.processor.origTask;
  const diffTask = utils.getObjectDifference(origTask, task);
  diffTask["instanceId"] = task.instanceId;
  diffTask["id"] = task.id;
  diffTask["processor"] = task.processor;
  delete diffTask.processor.origTask; // Only used internally

  diffTask.user = task.user || {};
  diffTask.user["id"] = globalState.user.userId;

  // The immediate destination of this request
  let fetchUrl = `${hubUrl}/api/task/`; // using hub routing

  try {
    const validatedTaskJsonString = fromTask(diffTask);
    const validatedTaskObject = JSON.parse(validatedTaskJsonString);
    messageJsonString = JSON.stringify({ task: task });
    } catch (error) {
    console.log("Error while converting Task to JSON:", error, task);
    return;
  }

  //log("messageJsonString", messageJsonString);

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: messageJsonString,
  };

  const response = await fetch(fetchUrl, requestOptions);

  let result = "ok"
  if (!response.ok) {
    if (response.status === 423) {
      // Resource is locked, handle the situation
      console.log('Resource is locked, try again later');
      result = "locked";
    } else {
      console.error('An error occurred: response status ' + response.status);
      //throw new Error('An error occurred: response status ' + response.status);
    }
  } 

  return result;
  
};
