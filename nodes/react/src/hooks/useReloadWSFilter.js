import { useEffect, useCallback } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";

function useReloadWSFilter(onMessage) {

  const handleMessage = async (task) => {
    //console.log("useReloadWSFilter handleMessage", task);
    const keys = Object.keys(messageQueue);
    // sort the keyys so we process the oldest first
    keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    //console.log("useUpdateWSFilter initialTask.instanceId", initialTask.instanceId, "keys", keys);
    for (let key of keys) {
      const message = messageQueue[key];
      //console.log("message", message, key);
      if (message && message?.command && message.command === "reload") {
        await onMessage(message.task);
        delete messageQueue[key];
      }
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useReloadWSFilter useEffect adding handleMessage instanceId", instanceId);
    webSocketEventEmitter.on("reload", handleMessage);
    return () => {
      //console.log("useReloadWSFilter useEffect removing handleMessage instanceId", instanceId);
      webSocketEventEmitter.removeListener("reload", handleMessage);
    };
  }, []);
  
}

export default useReloadWSFilter;
