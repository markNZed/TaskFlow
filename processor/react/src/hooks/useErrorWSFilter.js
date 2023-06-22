import { useEffect, useCallback } from "react";
import { webSocketEventEmitter, messageQueueRef } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useErrorWSFilter(familyId, onError) {

  const handleError = (task) => {
    if (familyId && task.familyId === familyId && task.error ) {
      //console.log("useErrorWSFilter handleError", task);
      onError(task);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useErrorWSFilter useEffect adding handleError familyId", familyId);
    webSocketEventEmitter.on("update", handleError);
    return () => {
      //console.log("useErrorWSFilter useEffect removing handleError familyId", familyId);
      webSocketEventEmitter.removeListener("update", handleError);
    };
  }, [familyId]);
  
}

export default useErrorWSFilter;
