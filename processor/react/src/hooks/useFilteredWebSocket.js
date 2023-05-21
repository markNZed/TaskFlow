import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useFilteredWebSocket(instanceId, onMessage) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleMessage = (e) => {
    //console.log("useFilteredWebSocket handleMessage", e);
    if (e.data instanceof Blob) {
      console.log("e.data is a Blob");
      return
    }
    const message = JSON.parse(e.data);
    if (
      instanceId &&
      message?.task &&
      message.task?.instanceId === instanceId
    ) {
      onMessage(message.task);
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
