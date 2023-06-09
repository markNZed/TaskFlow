import { useEffect, useCallback, useState } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useStartWSFilter(startTaskId, onStart) {
  
  const { webSocketEventEmitter } = useWebSocketContext();
  const [eventQueue, setEventQueue] = useState([]);
  const [working, setWorking] = useState(false);

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
    //console.log("useStartWSFilter useEffect adding handleStart taskId", taskId);
    webSocketEventEmitter.on("start", handleStart);
    return () => {
      //console.log("useStartWSFilter useEffect removing handleStart taskId", taskId);
      webSocketEventEmitter.removeListener("start", handleStart);
    };
  }, [startTaskId]);
  
}

export default useStartWSFilter;
