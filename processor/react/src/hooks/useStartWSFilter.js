import { useEffect, useCallback, useState } from "react";
import { webSocketEventEmitter, messageQueueRef } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useStartWSFilter(useGlobalStateContext, startTaskId, onStart) {
  
  const { globalState } = useGlobalStateContext();
  const [eventQueue, setEventQueue] = useState([]);
  const [working, setWorking] = useState(false);

  const startTaskDB = async (task) => {
    // We are not using this storage yet
    // We will need to clean it up
    if (globalState.storageRef) {
      globalState.storageRef.current.set(task.instanceId, task);
      //const value = await storageRef.current.get("a1");
      console.log("Storage start ", task.id, task.instanceId);
    } else {
      console.log("Storage not ready ", task.id, task.instanceId);
    }
  };

  const handleStart = (task) => {
    //console.log("useStartWSFilter handleStart with startTaskId, task:", startTaskId, task);
    if (startTaskId && startTaskId === task.id) {
      console.log("useStartWSFilter handleStart", startTaskId, task);
      setEventQueue((prev) => [...prev, task]);
    }
  };

  useEffect(() => {
    const startTask = async () => {
      if (eventQueue.length && !working) {
        setWorking(true);
        startTaskDB(eventQueue[0]);
        await onStart(eventQueue[0]);
        //pop the first task from eventQueue
        setEventQueue((prev) => prev.slice(1));
        setWorking(false);
      }
    };
    startTask();
  }, [eventQueue, working]);

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useStartWSFilter useEffect adding handleStart startTaskId", startTaskId);
    webSocketEventEmitter.on("start", handleStart);
    return () => {
      //console.log("useStartWSFilter useEffect removing handleStart startTaskId", startTaskId);
      webSocketEventEmitter.removeListener("start", handleStart);
    };
  }, [startTaskId]);
  
}

export default useStartWSFilter;
