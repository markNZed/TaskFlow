import { nodejsUrl, hubUrl } from "../config";
import { toTask, fromTask } from "./taskConverterWrapper";
import { log } from "./utils";

export const fetchTask = async (globalState, end_point, task) => {

  let messageJsonString;

  task.source = "react"

  // This does not seem right, maybe need a fetchHub and fetchProcessor
  let server;
  if (end_point === "task/start") {
    server = hubUrl;
  } else {
    server = nodejsUrl;
  }

  task.sessionId = globalState.sessionId;
  if ( globalState?.address && task.request ) {
    task.request["address"] = globalState.address;
  }
  task.newSource = globalState.processorId;

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

  const data = await response.json();

  if (data.task === "synchronizing") {
    return data.task;
  } else {
    try {
      const task = toTask(JSON.stringify(data.task));
      return task;
    } catch (error) {
      console.log("Error while converting JSON to Task:", error, data);
    }
  }
};
