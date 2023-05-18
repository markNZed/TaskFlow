import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useFilteredWebSocket(instanceId, onMessage) {
  
  const { webSocketEventEmitter } = useWebSocketContext();
  
  const handleMessage = useCallback((e) => {
    const message = JSON.parse(e.data);
    if (
      instanceId &&
      message?.task &&
      message.task?.instanceId === instanceId
    ) {
      onMessage(message.task);
    }
  }, [instanceId, onMessage]);

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    webSocketEventEmitter.on("message", handleMessage);
    return () => {
      webSocketEventEmitter.removeListener("message", handleMessage);
    };
  }, [webSocketEventEmitter, handleMessage]);
  
}

export default useFilteredWebSocket;
