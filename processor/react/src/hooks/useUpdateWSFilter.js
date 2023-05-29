import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useUpdateWSFilter(task, onUpdate) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleUpdate = (taskUpdate) => {
    //console.log("useUpdateWSFilter handleUpdate", task, instanceId);
    if (task && task.instanceId && taskUpdate.instanceId === task.instanceId) {
      //console.log("useUpdateWSFilter handleUpdate calling onUpdate", taskUpdate);
      onUpdate(taskUpdate);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useUpdateWSFilter useEffect adding handleUpdate instanceId", instanceId);
    webSocketEventEmitter.on("update", handleUpdate);
    return () => {
      //console.log("useUpdateWSFilter useEffect removing handleUpdate instanceId", instanceId);
      webSocketEventEmitter.removeListener("update", handleUpdate);
    };
  }, [[task, onUpdate, webSocketEventEmitter]]);
  
}

export default useUpdateWSFilter;
