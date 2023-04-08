import React,{ useContext } from 'react';
import { EventEmitter } from 'events';

class WebSocketEventEmitter extends EventEmitter {}

const WebSocketContext = React.createContext();

function useWebSocket() {
    return useContext(WebSocketContext);
}
   
export {WebSocketContext, useWebSocket, WebSocketEventEmitter};
