import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useFilteredWebSocket(instanceId, onMessage) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  // If instanceId or the onMessage function change then the callback will be recreated

  const handleMessage = useCallback((e) => {
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
  }, [instanceId, onMessage]);

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    console.log("useFilteredWebSocket useEffect adding handleMessage")
    webSocketEventEmitter.on("message", handleMessage);
    return () => {
      webSocketEventEmitter.removeListener("message", handleMessage);
    };
  }, [webSocketEventEmitter, handleMessage]);
  
}

export default useFilteredWebSocket;
