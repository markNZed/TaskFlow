import { useEffect } from 'react';

function useFilteredWebSocket(webSocketEventEmitter, task, onMessage) {

  useEffect(() => {

    if (!webSocketEventEmitter) {
      return;
    }

    const handleMessage = (e) => {
      const message = JSON.parse(e.data);
      console.log("task?.instanceId ", task?.instanceId, " message?.instanceId ", message?.instanceId)
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