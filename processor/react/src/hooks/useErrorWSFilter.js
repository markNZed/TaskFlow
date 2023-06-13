import { useEffect, useCallback } from "react";
import { webSocketEventEmitter, messageQueueRef } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useErrorWSFilter(threadId, onError) {

  const handleError = (task) => {
    if (threadId && task.threadId === threadId && task.error ) {
      //console.log("useErrorWSFilter handleError", task);
      onError(task);
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useErrorWSFilter useEffect adding handleError threadId", threadId);
    webSocketEventEmitter.on("update", handleError);
    return () => {
      //console.log("useErrorWSFilter useEffect removing handleError threadId", threadId);
      webSocketEventEmitter.removeListener("update", handleError);
    };
  }, [threadId]);
  
}

export default useErrorWSFilter;
