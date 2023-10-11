import { useEffect, useState } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";
import { utils } from "../utils/utils.mjs";

function useInitWSFilter(useGlobalStateContext, initialTask, onStart) {
  
  const { globalState } = useGlobalStateContext();
  const [initiatingInstanceId, setInitiatingInstanceId] = useState();

  const startTaskDB = async (task) => {
    // We are not using this storage yet
    // We will need to clean it up
    if (globalState.storageRef) {
      await utils.processorActiveTasksStoreSet_async(utils.createSetStorage(globalState.storageRef), task);
      //const value = await storageRef.current.get("a1");
      console.log("Storage start ", task.id, task.instanceId);
    } else {
      console.log("Storage not ready ", task.id, task.instanceId);
    }
  };

  const handleStart = async (taskStart) => {
    // messageQueue is an object not an array so we can delete from the object during iteration
    const keys = Object.keys(messageQueue);
    // sort the keyys so we process the oldest first
    keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    //console.log("keys", keys);
    for (let key of keys) {
      const message = messageQueue[key];
      //console.log("message", message, key);
      if (message && message?.command && (message.command === "init" || message.command === "join")) {
        //console.log("message", message, key);
        //console.log("useInitWSFilter " + initialTask + " initiatingInstanceId " + initiatingInstanceId);
        // The initial taskflow task does not have an instanceId (it is created on this processor)
        const prevInstanceId = initiatingInstanceId && (message.task.meta.prevInstanceId === initiatingInstanceId);
        const parentInstanceId = initiatingInstanceId && (message.task.meta.parentInstanceId === initiatingInstanceId);
        //console.log("initialTask.instanceId", initialTask.instanceId, "globalState.nodeId", globalState.nodeId);
        const processor = initialTask.instanceId ===  globalState.nodeId && (message.task.meta.parentInstanceId === undefined);
        if (prevInstanceId || parentInstanceId || processor) {
          //console.log("initiatingInstanceId && message.task.meta.prevInstanceId === initiatingInstanceId", initiatingInstanceId && message.task.meta.prevInstanceId === initiatingInstanceId)
          // Important to wait so that the task is saved to storage before it is retrieved again
          // We copy it so w can delete it ASAP
          const taskCopy = JSON.parse(JSON.stringify(message.task)); // deep copy
          delete messageQueue[key];
          startTaskDB(taskCopy);
          setInitiatingInstanceId(null);
          await onStart(taskCopy);
          //console.log("useInitWSFilter handleUpdate delete key", messageQueue);
        }
      }
    }
    //console.log("useInitWSFilter useEffect after messageQueue", messageQueue);
  };

  useEffect(() => {
    if (initialTask?.command === "start") {
      //console.log("useInitWSFilter initialTask", initialTask);
      setInitiatingInstanceId(initialTask?.commandArgs?.prevInstanceId || initialTask.instanceId);
    }
  }, [initialTask]);

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useInitWSFilter useEffect adding handleStart startTaskId", startTaskId);
    webSocketEventEmitter.on("init", handleStart);
    webSocketEventEmitter.on("join", handleStart);
    return () => {
      //console.log("useInitWSFilter useEffect removing handleStart startTaskId", startTaskId);
      webSocketEventEmitter.removeListener("init", handleStart);
      webSocketEventEmitter.removeListener("join", handleStart);
    };
  }, [initiatingInstanceId]);
  
}

export default useInitWSFilter;
