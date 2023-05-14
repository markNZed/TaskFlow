import { serverUrl } from "../config";
import { toTask, fromTask } from "./taskConverterWrapper";
import { log } from "./utils";

export const fetchTask = async (globalState, end_point, task) => {
  const sideband = {
    sessionId: globalState.sessionId,
    address: globalState?.address,
  };

  let messageJsonString;

  //log("task", task)

  try {
    const validatedTaskJsonString = fromTask(task);
    const validatedTaskObject = JSON.parse(validatedTaskJsonString);
    const messageObject = {
      ...sideband,
      task: validatedTaskObject,
    };
    messageJsonString = JSON.stringify(messageObject);
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

  const response = await fetch(`${serverUrl}api/${end_point}`, requestOptions);

  const data = await response.json();

  try {
    const task = toTask(JSON.stringify(data.task));
    return task;
  } catch (error) {
    console.log("Error while converting JSON to Task:", error, data);
  }
};
