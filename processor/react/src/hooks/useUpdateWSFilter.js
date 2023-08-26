import { useEffect, useState, useRef } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";

// The wbsocket is re-rendering which causes the useUpdateWSFilter to rerender which
// loses the state, so can't remember the task

// We pass in isMountedRef so the update does not get overwritten by Task initializations
function useUpdateWSFilter(isMountedRef, initialTask, onUpdate) {

  //console.log("------------ useUpdateWSFilter ---------------", initialTask);

  const [instanceId, setInstanceId] = useState();
  const processingRef = useRef(false);

  // No need for a local queue if we use messageQueue
  // Needs to pass task. Not 100% sure why. Maybe setTask is creating a new object so the reference is lost?
  const handleUpdate = async (taskUpdate) => {
    if (processingRef.current) {return}
    // messageQueue is an object not an array so we can delete from the object during iteration
    const keys = Object.keys(messageQueue);
    // sort the keyys so we process the oldest first
    keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    //console.log("useUpdateWSFilter initialTask.instanceId", initialTask.instanceId, "keys", keys);
    for (let key of keys) {
      const message = messageQueue[key];
      //console.log("message", message, key);
      if (message && message?.command && message.command === "update") {
        //console.log("useUpdateWSFilter handleUpdate update key", key, message.task.instanceId, initialTask.instanceId);
        if (message.task.instanceId === initialTask.instanceId) {
          //console.log("useUpdateWSFilter handleUpdate calling onUpdate", taskUpdate);
          // Important to wait so that the task is saved to storage before it is retrieved again
          processingRef.current = true;
          await onUpdate(message.task);
          delete messageQueue[key];
          processingRef.current = false;
          //console.log("useUpdateWSFilter handleUpdate delete key", messageQueue);
        }
      }
    }
    //console.log("useUpdateWSFilter useEffect after messageQueue", messageQueue);
  };

  // Create instanceId from initialTask so we can have webSocketEventEmitter sensitive to
  // just this (not initialTask)
  // Set the instance after isMountedRef and senstive to onUpdate so we get an event
  useEffect(() => {
    if (initialTask?.instanceId !== instanceId && isMountedRef.current) {
      setInstanceId(initialTask.instanceId);
    }
  }, [initialTask, onUpdate]);

  // This being sensitive to task seems overkill
  // Can the task be passed in as a parameter to onUpdate?
  useEffect(() => {
    //console.log("useUpdateWSFilter useEffect", webSocketEventEmitter, isMountedRef.current, instanceId);
    if (!webSocketEventEmitter || !isMountedRef.current || !instanceId) {
      return;
    }
    //console.log("useUpdateWSFilter useEffect adding handleUpdate instanceId", instanceId);
    webSocketEventEmitter.on("update", handleUpdate);
    if (Object.keys(messageQueue).length > 0) {
      //console.log("useUpdateWSFilter useEffect messageQueue", Object.keys(messageQueue).length);
      handleUpdate();
    }
    // The return is called each time prior to the effect
    // So if it does not set the webSocketEventEmitter we do not want to remove it
    return () => {
      //console.log("useUpdateWSFilter useEffect removing handleUpdate instanceId", instanceId);
      webSocketEventEmitter.removeListener("update", handleUpdate);
    };
  }, [instanceId, onUpdate]);
  
}

export default useUpdateWSFilter;
