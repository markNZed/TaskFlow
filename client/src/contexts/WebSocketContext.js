import React,{ useContext, useState } from 'react';
import { EventEmitter } from 'events';
import useWebSocket from 'react-use-websocket'
import { useGlobalStateContext } from './GlobalStateContext';

class WebSocketEventEmitter extends EventEmitter {}

const WebSocketContext = React.createContext();

export const webSocketEventEmitter = new WebSocketEventEmitter();

export function useWebSocketContext() {
    return useContext(WebSocketContext);
}

export function WebSocketProvider({ children, socketUrl}) {
    const [webSocket, setWebSocket] = useState(null);
    const { globalState } = useGlobalStateContext();

    const { sendJsonMessage, getWebSocket } = useWebSocket(socketUrl, {
        reconnectAttempts: 10,
        reconnectInterval: 500,
        shouldReconnect: (closeEvent) => {
        return true;
        },
        onOpen: (e) => {
            console.log('App webSocket connection established.');
            let ws = getWebSocket()
            setWebSocket(ws)
            sendJsonMessagePlus({ping : "ok"});
            const intervalId = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    sendJsonMessagePlus({ping : "ok"});
                } else {
                  // WebSocket is not open, clear the interval
                  clearInterval(intervalId);
                }
            }, 30 * 1000); // 30 seconds
            ws.pingIntervalId = intervalId;
        },
        onMessage: (e) => {
            webSocketEventEmitter.emit('message', e);
            //console.log(e)
        },
        onClose: (e) => {
            console.log(`App webSocket closed with code ${e.code} and reason '${e.reason}'`);
            let ws = getWebSocket()
            if (ws.pingIntervalId) {
                clearInterval(ws.pingIntervalId);
            }
        },

    });

    const sendJsonMessagePlus = function(m) {
        if (globalState?.sessionId) {
            m.sessionId = globalState.sessionId
        }
        sendJsonMessage(m)
    }

    const connectionStatus = webSocket
    ? {
        [WebSocket.CONNECTING]: 'Connecting',
        [WebSocket.OPEN]: 'Open',
        [WebSocket.CLOSING]: 'Closing',
        [WebSocket.CLOSED]: 'Closed',
      }[webSocket.readyState]
    : 'Uninstantiated';
  
    return (
      <WebSocketContext.Provider value={{connectionStatus, webSocketEventEmitter, sendJsonMessagePlus}}>
        {children}
      </WebSocketContext.Provider>
    );
}

