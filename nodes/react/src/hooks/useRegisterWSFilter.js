import { useEffect, useCallback } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";

function useRegisterWSFilter(onMessage) {

  const handleMessage = async (task) => {
    //console.log("useRegisterWSFilter handleMessage", task);
    const keys = Object.keys(messageQueue);
    // sort the keyys so we process the oldest first
    keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    //console.log("useUpdateWSFilter initialTask.instanceId", initialTask.instanceId, "keys", keys);
    for (let key of keys) {
      const message = messageQueue[key];
      //console.log("message", message, key);
      if (message && message?.command && message.command === "register") {
        await onMessage(message.task);
        delete messageQueue[key];
      }
    }
  };

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useRegisterWSFilter useEffect adding handleMessage instanceId", instanceId);
    webSocketEventEmitter.on("register", handleMessage);
    return () => {
      //console.log("useRegisterWSFilter useEffect removing handleMessage instanceId", instanceId);
      webSocketEventEmitter.removeListener("register", handleMessage);
    };
  }, []);
  
}

export default useRegisterWSFilter;
