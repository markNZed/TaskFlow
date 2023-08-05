import { hubUrl } from "../config";
import { toTask, fromTask } from "./taskConverterWrapper";
import { utils } from "./utils";

export const fetchTask = async (globalState, task) => {

  task = utils.taskInProcessorOut(task, globalState.processorId) 
  task.user["id"] = globalState.user.userId;

  // The immediate destination of this request
  let fetchUrl = `${hubUrl}/api/task/`; // using hub routing

  let messageJsonString;
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
