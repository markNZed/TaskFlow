import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useUpdateWSFilter(instanceId, onUpdate) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleUpdate = (task) => {
    //console.log("useUpdateWSFilter handleUpdate", task, instanceId);
    if (instanceId && task.instanceId === instanceId) {
      console.log("useUpdateWSFilter handleUpdate calling onUpdate", task);
      onUpdate(task);
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
  }, []);
  
}

export default useUpdateWSFilter;
