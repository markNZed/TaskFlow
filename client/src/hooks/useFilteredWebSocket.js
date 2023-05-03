import { useEffect } from 'react';
import { log } from '../utils/utils'

function useFilteredWebSocket(webSocketEventEmitter, task, onMessage) {

  useEffect(() => {

    if (!webSocketEventEmitter) {
      return;
    }

    const handleMessage = (e) => {
      const message = JSON.parse(e.data);
      //log("useFilteredWebSocket ", message)
      if (task.meta?.instanceId && message?.partialTask && message.partialTask?.instanceId === task.meta.instanceId) {
        //log("useFilteredWebSocket ", message)
        onMessage(message.partialTask);
      }
    };

    webSocketEventEmitter.on('message', handleMessage);

    return () => {
      webSocketEventEmitter.removeListener('message', handleMessage);
    };
  }, [webSocketEventEmitter, task, onMessage]);

}

export default useFilteredWebSocket