import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useStartWSFilter(startTaskId, onStart) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleStart = (task) => {
    //console.log("useStartWSFilter handleStart with startTaskId, task:", startTaskId, task);
    if (startTaskId && startTaskId === task.id) {
      //console.log("useStartWSFilter handleStart", startTaskId, task);
      onStart(task);
    }
  };

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
