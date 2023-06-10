import { useEffect, useState } from "react";
import useWebSocketContext from "../contexts/WebSocketContext";
import { log } from "../utils/utils";

function useUpdateWSFilter(task, onUpdate) {
  
  const { webSocketEventEmitter } = useWebSocketContext();
  const [eventQueue, setEventQueue] = useState([]);
  const [working, setWorking] = useState(false);

  const handleUpdate = (taskUpdate) => {
    //console.log("useUpdateWSFilter handleUpdate", task, instanceId);
    if (task && task.instanceId && taskUpdate.instanceId === task.instanceId) {
      //console.log("useUpdateWSFilter handleUpdate calling onUpdate", taskUpdate);
      setEventQueue((prev) => [...prev, taskUpdate]);
    }
  };

  useEffect(() => {
    const updateTask = async () => {
      if (eventQueue.length && !working) {
        setWorking(true);
        await onUpdate(eventQueue[0]);
        //pop the first task from eventQueue
        setEventQueue((prev) => prev.slice(1));
        setWorking(false);
      }
    };
    updateTask();
  }, [eventQueue, working]);

  useEffect(() => {
    if (!webSocketEventEmitter) {
      return;
    }
    //console.log("useUpdateWSFilter useEffect adding handleUpdate instanceId", instanceId);
    webSocketEventEmitter.on("update", handleUpdate);
    return () => {
      //console.log("useUpdateWSFilter useEffect removing handleUpdate instanceId", instanceId);
      webSocketEventEmitter.removeListener("update", handleUpdate);
    };
  }, [task, onUpdate, webSocketEventEmitter]);
  
}

export default useUpdateWSFilter;
