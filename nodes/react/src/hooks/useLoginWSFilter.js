import { useEffect, useCallback } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";

function useLoginWSFilter(onMessage) {

  const handleMessage = async (task) => {
    //console.log("useLoginWSFilter handleMessage", task);
    const keys = Object.keys(messageQueue);
    // sort the keyys so we process the oldest first
    keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    //console.log("useUpdateWSFilter initialTask.instanceId", initialTask.instanceId, "keys", keys);
    for (let key of keys) {
      const message = messageQueue[key];
      //console.log("message", message, key);
      if (message && message?.command && message.command === "login") {
        await onMessage(message.task);
        delete messageQueue[key];
      }
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useLoginWSFilter useEffect adding handleMessage instanceId", instanceId);
    webSocketEventEmitter.on("login", handleMessage);
    return () => {
      //console.log("useLoginWSFilter useEffect removing handleMessage instanceId", instanceId);
      webSocketEventEmitter.removeListener("login", handleMessage);
    };
  }, []);
  
}

export default useLoginWSFilter;
