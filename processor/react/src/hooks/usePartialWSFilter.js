import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function usePartialWSFilter(instanceId, onMessage) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleMessage = (task) => {
    //console.log("usePartialWSFilter handleMessage", task);
    if (instanceId && task.instanceId === instanceId) {
      onMessage(task);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("usePartialWSFilter useEffect adding handleMessage instanceId", instanceId);
    webSocketEventEmitter.on("partial", handleMessage);
    return () => {
      //console.log("usePartialWSFilter useEffect removing handleMessage instanceId", instanceId);
      webSocketEventEmitter.removeListener("partial", handleMessage);
    };
  }, []);
  
}

export default usePartialWSFilter;
