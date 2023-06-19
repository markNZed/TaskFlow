import { useEffect, useCallback, useState } from "react";
import { webSocketEventEmitter, messageQueueRef } from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useNextWSFilter(useGlobalStateContext, doneTask, onNext) {
  
  const { globalState } = useGlobalStateContext();
  const [eventQueue, setEventQueue] = useState([]);
  const [working, setWorking] = useState(false);
  const [instanceId, setInstanceId] = useState();

  const handleNext = (task) => {
    //console.log("useNextWSFilter handleNext", doneTask, task);
    const processorId = globalState?.processorId
    if (task && instanceId && task.prevInstanceId[processorId] === instanceId ) {
      //console.log("useNextWSFilter handleNext instanceId ", instanceId);
      //console.log("useNextWSFilter handleNext", task);
      setEventQueue((prev) => [...prev, task]);
    }
  };

  useEffect(() => {
    const nextTask = async () => {
      if (eventQueue.length && !working) {
        setWorking(true);
        await onNext(eventQueue[0]);
        //pop the first task from eventQueue
        setEventQueue((prev) => prev.slice(1));
        setWorking(false);
      }
    };
    nextTask();
  }, [eventQueue, working]);

  // Create instanceId from initialTask so we can have webSocketEventEmitter sensitive to
  // just this (not initialTask)
  useEffect(() => {
    if (doneTask?.instanceId) {
      setInstanceId(doneTask.instanceId);
    }
  }, [doneTask]);

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useNextWSFilter useEffect adding handleNext instanceId", instanceId);
    webSocketEventEmitter.on("start", handleNext);
    return () => {
      //console.log("useNextWSFilter useEffect removing handleNext instanceId", instanceId);
      webSocketEventEmitter.removeListener("start", handleNext);
    };
  }, [instanceId, doneTask]);
  
}

export default useNextWSFilter;
