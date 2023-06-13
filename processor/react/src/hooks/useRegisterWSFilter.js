import { useEffect, useCallback } from "react";
import { webSocketEventEmitter, messageQueueRef } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useRegisterWSFilter(onMessage) {

  const handleMessage = (task) => {
    //console.log("useRegisterWSFilter handleMessage", task);
    onMessage(task);
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
