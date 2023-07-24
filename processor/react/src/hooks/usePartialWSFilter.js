import { useEffect, useCallback, useState } from "react";
import { webSocketEventEmitter, messageQueueRef } from "../contexts/WebSocketContext";

function usePartialWSFilter(initialTask, onMessage) {


  const [instanceId, setInstanceId] = useState();

  const handleMessage = (task) => {
    //console.log("usePartialWSFilter handleMessage", task, instanceId);
    if (task.instanceId && task.instanceId === instanceId) {
      //console.log("usePartialWSFilter handleMessage matched", instanceId);
      onMessage(task);
    }
  };

    // Create instanceId from initialTask so we can have webSocketEventEmitter sensitive to
  // just this (not initialTask)
  useEffect(() => {
    if (initialTask?.instanceId) {
      setInstanceId(initialTask.instanceId);
    }
  }, [initialTask]);

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
  }, [instanceId]);
  
}

export default usePartialWSFilter;
