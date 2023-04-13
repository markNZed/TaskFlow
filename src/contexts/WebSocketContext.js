import React,{ useContext, useState } from 'react';
import { EventEmitter } from 'events';
import useWebSocket from 'react-use-websocket'
import { useGlobalStateContext } from './GlobalStateContext';

class WebSocketEventEmitter extends EventEmitter {}

const WebSocketContext = React.createContext();

export function useWebSocketContext() {
    return useContext(WebSocketContext);
}

export function WebSocketProvider({ children, socketUrl}) {
    const [webSocket, setWebSocket] = useState(null);
    const webSocketEventEmitter = new WebSocketEventEmitter();
    const { globalState, updateGlobalState } = useGlobalStateContext();

    // This needs to move to API
    const [lastAddress, setLastAddress] = useState('');

    // Here we fetch the sessionId if we don't already have one
    const { sendJsonMessage, getWebSocket } = useWebSocket(socketUrl, {
        reconnectAttempts: 10,
        reconnectInterval: 500,
        shouldReconnect: (closeEvent) => {
        return true;
        },
        onOpen: (each) => {
        console.log('App webSocket connection established.');
        setWebSocket(getWebSocket())
        },
        onMessage: (e) => {
        const j = JSON.parse(e.data)
        if (j?.sessionId && globalState.sessionId === '') {
            updateGlobalState({
                sessionId : j.sessionId
            })
            console.log("Init sessionId ", j.sessionId)
        }
        webSocketEventEmitter.emit('message', e);
        },
        onClose: (event) => {
        console.log(`App webSocket closed with code ${event.code} and reason '${event.reason}'`);
        },

    });

    const sendJsonMessagePlus = function(m) {
        // Only send the address when it changes
        if (globalState?.address && lastAddress != globalState.address) {
            m.address = globalState.address
            setLastAddress(globalState.address)
        }
        if (globalState.sessionId) {
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

export {WebSocketEventEmitter};
