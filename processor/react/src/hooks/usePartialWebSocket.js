import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function usePartialWebSocket(instanceId, onMessage) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleMessage = (task) => {
    //console.log("usePartialWebSocket handleMessage", task);
    if (instanceId && task.instanceId === instanceId) {
      onMessage(task);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("usePartialWebSocket useEffect adding handleMessage instanceId", instanceId);
    webSocketEventEmitter.on("partial", handleMessage);
    return () => {
      //console.log("usePartialWebSocket useEffect removing handleMessage instanceId", instanceId);
      webSocketEventEmitter.removeListener("partial", handleMessage);
    };
  }, []);
  
}

export default usePartialWebSocket;
