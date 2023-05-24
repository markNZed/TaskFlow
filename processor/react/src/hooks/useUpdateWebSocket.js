import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useUpdateWebSocket(instanceId, onUpdate) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleUpdate = (task) => {
    //console.log("useUpdateWebSocket handleUpdate", task);
    if (instanceId && task.instanceId === instanceId) {
      onUpdate(task);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useUpdateWebSocket useEffect adding handleUpdate instanceId", instanceId);
    webSocketEventEmitter.on("update", handleUpdate);
    return () => {
      //console.log("useUpdateWebSocket useEffect removing handleUpdate instanceId", instanceId);
      webSocketEventEmitter.removeListener("update", handleUpdate);
    };
  }, []);
  
}

export default useUpdateWebSocket;
