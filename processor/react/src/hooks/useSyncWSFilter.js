import { useEffect, useState } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

// The wbsocket is re-rendering which causes the useSyncWSFilter to rerender which
// loses the state, so can't remember the task

// We pass in isMounted so the sync does not get overwritten by Task initializations
function useSyncWSFilter(isMounted, initialTask, onSync) {

  //console.log("------------ useSyncWSFilter ---------------", initialTask);

  const [instanceId, setInstanceId] = useState();

  // No need for a local queue if we use messageQueue
  // Needs to pass task. Not 100% sure why. Maybe setTask is creating a new object so the reference is lost?
  const handleSync = async (taskSync) => {
    // messageQueue is an object not an array so we can delete from the object during iteration
    const keys = Object.keys(messageQueue);
    // sort the keyys so we process the oldest first
    keys.sort();
    //console.log("keys", keys);
    for (let key of keys) {
      const message = messageQueue[key];
      //console.log("message", message, key);
      if (message && message?.command && message.command === "sync") {
        //console.log("useSyncWSFilter handleSync sync key", key);
        if (message.task.instanceId === initialTask.instanceId) {
          //console.log("useSyncWSFilter handleSync calling onSync", taskSync);
          // Important to wait so that the task is saved to storage before it is retrieved again
          // We copy it so w can delete it ASAP
          const taskCopy = JSON.parse(JSON.stringify(message.task)); // deep copy
          delete messageQueue[key];
          await onSync(taskCopy);
          //console.log("useSyncWSFilter handleSync delete key", messageQueue);
        }
      }
    }
    //console.log("useSyncWSFilter useEffect after messageQueue", messageQueue);
  };

  // Create instanceId from initialTask so we can have webSocketEventEmitter sensitive to
  // just this (not initialTask)
  useEffect(() => {
    if (initialTask?.instanceId !== instanceId) {
      setInstanceId(initialTask.instanceId);
    }
  }, [initialTask]);

  // This being sensitive to task seems overkill
  // Can the task be passed in as a parameter to onSync?
  useEffect(() => {
    if (!webSocketEventEmitter || !isMounted || !instanceId) {
      return;
    }
    //console.log("useSyncWSFilter useEffect adding handleSync");
    webSocketEventEmitter.on("sync", handleSync);
    if (Object.keys(messageQueue).length > 0) {
      //console.log("useSyncWSFilter useEffect messageQueue", Object.keys(messageQueue).length);
      handleSync();
    }
    // The return is called each time prior to the effect
    // So if it does not set the webSocketEventEmitter we do not want to remove it
    return () => {
      //console.log("useSyncWSFilter useEffect removing handleSync instanceId", myInstanceId);
      webSocketEventEmitter.removeListener("sync", handleSync);
    };
  }, [instanceId, onSync, isMounted]);
  
}

export default useSyncWSFilter;
