import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useNextWebSocket(instanceId, onNext) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleNext = (task) => {
    //console.log("useNextWebSocket handleNext", task);
    if (instanceId && task.prevInstanceId === instanceId) {
      onNext(task);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useNextWebSocket useEffect adding handleNext instanceId", instanceId);
    webSocketEventEmitter.on("update", handleNext);
    return () => {
      //console.log("useNextWebSocket useEffect removing handleNext instanceId", instanceId);
      webSocketEventEmitter.removeListener("update", handleNext);
    };
  }, []);
  
}

export default useNextWebSocket;
