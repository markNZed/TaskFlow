import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useStartWebSocket(startTaskId, onStart) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleStart = (task) => {
    console.log("useStartWebSocket handleStart with startTaskId, task:", startTaskId, task);
    if (startTaskId 
      && startTaskId === task.id 
      && task.prevInstanceId === null
    ) {
      console.log("useStartWebSocket handleStart", startTaskId, task);
      //setStartTaskId(null);
      onStart(task);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useStartWebSocket useEffect adding handleStart taskId", taskId);
    webSocketEventEmitter.on("update", handleStart);
    return () => {
      //console.log("useStartWebSocket useEffect removing handleStart taskId", taskId);
      webSocketEventEmitter.removeListener("update", handleStart);
    };
  }, [startTaskId]);
  
}

export default useStartWebSocket;
