import { useEffect } from 'react';
import { log } from '../utils/utils'

function useFilteredWebSocket(webSocketEventEmitter, task, onMessage) {

  useEffect(() => {

    if (!webSocketEventEmitter) {
      return;
    }

    const handleMessage = (e) => {
      const message = JSON.parse(e.data);
      //log("useFilteredWebSocket ", task?.instanceId, message?.instanceId)
      if (task?.instanceId && message?.instanceId === task.instanceId) {
        onMessage(message);
      }
    };

    webSocketEventEmitter.on('message', handleMessage);

    return () => {
      webSocketEventEmitter.removeListener('message', handleMessage);
    };
  }, [webSocketEventEmitter, task, onMessage]);

}

export default useFilteredWebSocket