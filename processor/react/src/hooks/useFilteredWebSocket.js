import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useFilteredWebSocket(instanceId, onMessage) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleMessage = (task) => {
    //console.log("useFilteredWebSocket handleMessage", task);
    if (instanceId && task.instanceId === instanceId) {
      onMessage(task);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useFilteredWebSocket useEffect adding handleMessage instanceId", instanceId);
    webSocketEventEmitter.on("message", handleMessage);
    return () => {
      //console.log("useFilteredWebSocket useEffect removing handleMessage instanceId", instanceId);
      webSocketEventEmitter.removeListener("message", handleMessage);
    };
  }, []);
  
}

export default useFilteredWebSocket;
