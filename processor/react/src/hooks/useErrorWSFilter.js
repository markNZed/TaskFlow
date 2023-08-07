import { useEffect, useCallback, useState } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";

function useErrorWSFilter(useGlobalStateContext, initialTask, onError) {
  
  const { globalState } = useGlobalStateContext();
  const [eventQueue, setEventQueue] = useState([]);
  const [working, setWorking] = useState(false);
  const [instanceId, setInstanceId] = useState();
  const [errorPrevInstanceId, setErrorPrevInstanceId] = useState();

  const startTaskDB = async (task) => {
    // We are not using this storage yet
    // We will need to clean it up
    if (globalState.storageRef) {
      globalState.storageRef.current.set(task.instanceId, task);
      //const value = await storageRef.current.get("a1");
      console.log("Storage start(error) ", task.id, task.instanceId);
    } else {
      console.log("Storage not ready ", task.id, task.instanceId);
    }
  };

  const handleError = async (taskError) => {
    // messageQueue is an object not an array so we can delete from the object during iteration
    const keys = Object.keys(messageQueue);
    // sort the keyys so we process the oldest first
    keys.sort();
    //console.log("keys", keys);
    for (let key of keys) {
      const message = messageQueue[key];
      //console.log("message", message, key);
      if (message && message?.command && message.command === "error") {
        //console.log("useErrorWSFilter handleError update key", key, taskError, message.task.processor?.prevInstanceId, errorPrevInstanceId);
        if (message.task.id === instanceId ||
            message.task.meta?.prevInstanceId === errorPrevInstanceId) {
          //console.log("useErrorWSFilter handleError calling onError", taskError);
          // Important to wait so that the task is saved to storage before it is retrieved again
          // We copy it so w can delete it ASAP
          const taskCopy = JSON.parse(JSON.stringify(message.task)); // deep copy
          delete messageQueue[key];
          startTaskDB(taskCopy);
          await onError(taskCopy);
          //console.log("useErrorWSFilter handleError delete key", messageQueue);
        }
      }
    }
    //console.log("useErrorWSFilter useEffect after messageQueue", messageQueue);
  };

  useEffect(() => {
    if (initialTask?.instanceId !== instanceId) {
      //console.log("useErrorWSFilter initialTask commandArgs", initialTask.commandArgs);
      setInstanceId(initialTask.instanceId);
      setErrorPrevInstanceId(initialTask.instanceId);
    }
  }, [initialTask]);

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useErrorWSFilter useEffect adding handleError instanceId", instanceId);
    webSocketEventEmitter.on("error", handleError);
    return () => {
      //console.log("useErrorWSFilter useEffect removing handleError instanceId", instanceId);
      webSocketEventEmitter.removeListener("error", handleError);
    };
  }, [instanceId]);
  
}

export default useErrorWSFilter;
