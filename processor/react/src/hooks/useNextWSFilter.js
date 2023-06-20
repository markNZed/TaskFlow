import { useEffect, useCallback, useState } from "react";
import { webSocketEventEmitter, messageQueue } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useNextWSFilter(useGlobalStateContext, stackPtrRef, doneTask, onNext) {
  
  const { globalState } = useGlobalStateContext();
  const [instanceId, setInstanceId] = useState();
  const [stackPtr, setStackPtr] = useState();

  const handleNext = async (taskUpdate) => {
    if (instanceId === undefined || stackPtr === undefined) {
      return;
    }
    const processorId = globalState?.processorId
    // messageQueue is an object not an array so we can delete from the object during iteration
    const keys = Object.keys(messageQueue);
    // sort the keyys so we process the oldest first
    keys.sort();
    //console.log("keys", keys);
    for (let key of keys) {
      const message = messageQueue[key];
      //console.log("message", message, key);
      // We should add a "next" command perhaps
      if (message && message?.command && message.command === "next") {
        //console.log("useUpdateWSFilter handleUpdate update key", key);
         //console.log("stackPtrRef.current", stackPtrRef.current, stackPtr);
        if (message.task.processor.prevInstanceId === instanceId && stackPtrRef.current === stackPtr ) {
          //console.log("useUpdateWSFilter handleUpdate calling onUpdate", taskUpdate);
          // Important to wait so that the task is saved to storage before it is retrieved again
          // We copy it so w can delete it ASAP
          const taskCopy = JSON.parse(JSON.stringify(message.task)); // deep copy
          delete messageQueue[key];
          await onNext(taskCopy);
          //console.log("useUpdateWSFilter handleUpdate delete key", messageQueue);
        }
      }
    }
    //console.log("useUpdateWSFilter useEffect after messageQueue", messageQueue);
  };

  // Create instanceId from initialTask so we can have webSocketEventEmitter sensitive to
  // just this (not initialTask)
  useEffect(() => {
    if (doneTask && doneTask.processor?.command === "receiveNext") {
      const i = doneTask.processor.commandArgs?.instanceId;
      if (i && instanceId !== i) {
        setInstanceId(i);
      }
      const s = doneTask.processor.commandArgs?.stackPtr
      if (s && stackPtr !== s) {
        setStackPtr(s);
      }
    }
  }, [doneTask]);

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useNextWSFilter useEffect adding handleNext instanceId", instanceId);
    webSocketEventEmitter.on("next", handleNext);
    return () => {
      //console.log("useNextWSFilter useEffect removing handleNext instanceId", instanceId);
      webSocketEventEmitter.removeListener("next", handleNext);
    };
  }, [instanceId, stackPtr]);
  
}

export default useNextWSFilter;
