import { hubUrl } from "../config";
import { toTask, fromTask } from "./taskConverterWrapper";
import { log, updatedAt } from "./utils";

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

  task.userId = globalState.user.userId;

  // The immediate destination of this request
  let fetchUrl = `${hubUrl}/api/task/`; // using hub routing

  try {
    const validatedTaskJsonString = fromTask(task);
    const validatedTaskObject = JSON.parse(validatedTaskJsonString);
    messageJsonString = JSON.stringify({ task: validatedTaskObject });
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
  
  // Need to be able to roll back if we are sending an instance
  let rollback;
  if (task.instanceId) {
    rollback = await globalState.storageRef.current.get(task.instanceId);
    await globalState.storageRef.current.set(task.instanceId, task);
    //console.log("fetchTask stored task", task.instanceId, "in storageRef", task);
  }

  const response = await fetch(fetchUrl, requestOptions);

  let result = "ok"
  if (!response.ok) {
    if (response.status === 423) {
      // Resource is locked, handle the situation
      console.log('Resource is locked, try again later');
      result = "locked";
    } else {
      throw new Error('An error occurred: response status ' + response.status);
    }
    if (task.instanceId) {
      await globalState.storageRef.current.set(rollback.instanceId, rollback);
      console.log("fetchTask rolled back task", task.instanceId, "in storageRef", rollback);
    }
  } 

  return result;
  
};
