import { useEffect } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useFilteredWebSocket(instanceId, onMessage) {
  
  const { webSocketEventEmitter } = useWebSocketContext();
  
  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }

    const handleMessage = (e) => {
      const message = JSON.parse(e.data);
      //log("useFilteredWebSocket ", message)
      if (
        instanceId &&
        message?.partialTask &&
        message.partialTask?.instanceId === instanceId
      ) {
        //log("useFilteredWebSocket ", message)
        onMessage(message.partialTask);
      }
    };

    webSocketEventEmitter.on("message", handleMessage);

    return () => {
      webSocketEventEmitter.removeListener("message", handleMessage);
    };
  }, [webSocketEventEmitter, onMessage]);
}

export default useFilteredWebSocket;
