import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useNextWSFilter(instanceId, doneTask, onNext) {
  
  const { webSocketEventEmitter } = useWebSocketContext();

  const handleNext = (task) => {
    if (instanceId && task.prevInstanceId === instanceId) {
      //console.log("useNextWSFilter handleNext", task);
      onNext(task);
    }
  };

  useEffect(() => {
    if (doneTask) {
      if (!webSocketEventEmitter) {
        return;
      }
      //console.log("useNextWSFilter useEffect adding handleNext instanceId", instanceId);
      webSocketEventEmitter.on("update", handleNext);
      return () => {
        //console.log("useNextWSFilter useEffect removing handleNext instanceId", instanceId);
        webSocketEventEmitter.removeListener("update", handleNext);
      };
    }
  }, [instanceId, doneTask]);
  
}

export default useNextWSFilter;
