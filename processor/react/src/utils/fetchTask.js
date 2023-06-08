import { hubUrl } from "../config";
import { toTask, fromTask } from "./taskConverterWrapper";
import { log, updatedAt } from "./utils";

export const fetchTask = async (globalState, end_point, task) => {

  let messageJsonString;

  task["sessionId"] = globalState.sessionId;
  if ( globalState?.address && task.request ) {
    task.request["address"] = globalState.address;
  }
  task.source = globalState.processorId;

  // The immediate destination of this request
  let destination = `${hubUrl}/api/${end_point}` // using hub routing
  task.destination = globalState.hubId;

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
  
  const response = await fetch(destination, requestOptions);

  let result = "ok"
  if (!response.ok) {
    if (response.status === 423) {
      // Resource is locked, handle the situation
      console.log('Resource is locked, try again later');
      result = "locked";
    } else {
      throw new Error('An error occurred: response status ' + response.status);
    }
  } else if (task.instanceId) {
    const lastTask = await globalState.storageRef.current.get(task.instanceId);
    if (lastTask.updatedAt > task.updatedAt) {
      throw new Error('An error occurred: task was updated by another process ' + task.instanceId);
    }
    await globalState.storageRef.current.set(task.instanceId, task);
    console.log("fetchTask stored task", task.instanceId, "in storageRef");
  }

  return result;
  
};
