import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { useGlobalStateContext } from "../contexts/GlobalStateContext";
import { log } from "../utils/utils";

function useNextWSFilter(instanceId, doneTask, onNext) {
  
  const { webSocketEventEmitter } = useWebSocketContext();
  const { globalState } = useGlobalStateContext();

  const handleNext = (task) => {
    //console.log("useNextWSFilter handleNext", doneTask, task);
    //if (doneTask && task.prevInstanceId === doneTask.instanceId ) 
    // This means we can only have one nextTask
    // The problem is that an instance may move to a next instance on another processor
    // then we do not know how to find the next
    // Maybe we need the prevInstance per processor?
    //if (doneTask && task.threadId === doneTask.threadId ) 
    const processorId = globalState?.processorId
    if (doneTask && task && task.prevInstanceId && task.prevInstanceId[processorId] === doneTask.instanceId ) {
      console.log("useNextWSFilter handleNext doneTask.instanceId ", doneTask.instanceId, task.prevInstanceId);
      //console.log("useNextWSFilter handleNext", task);
      onNext(task);
    }
  };

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
