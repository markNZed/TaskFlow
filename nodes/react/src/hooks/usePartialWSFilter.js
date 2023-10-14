import { useEffect, useCallback, useState } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";

function usePartialWSFilter(initialTask, onMessage) {

  const [instanceId, setInstanceId] = useState();

  const handleMessage = async (task) => {
    //console.log("usePartialWSFilter handleMessage", task, instanceId);
    if (task.instanceId && task.instanceId === instanceId) {
      //console.log("usePartialWSFilter handleMessage matched", instanceId);
      const keys = Object.keys(messageQueue);
      // sort the keyys so we process the oldest first
      keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      //console.log("useUpdateWSFilter initialTask.instanceId", initialTask.instanceId, "keys", keys);
      for (let key of keys) {
        const message = messageQueue[key];
        //console.log("message", message, key);
        if (message && message?.command && message.command === "partial") {
          await onMessage(message.task);
          delete messageQueue[key];
        }
      }
    }
  };

    // Create instanceId from initialTask so we can have webSocketEventEmitter sensitive to
  // just this (not initialTask)
  useEffect(() => {
    if (initialTask?.instanceId && initialTask.instanceId !== instanceId) {
      console.log("initialTask?.instanceId", initialTask?.instanceId, instanceId);
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
