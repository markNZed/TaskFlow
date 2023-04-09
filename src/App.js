import React, {useState, useEffect} from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import './styles/normal.css';
import Workflows from "./components/Workflows"
import { WebSocketContext, WebSocketEventEmitter } from './contexts/WebSocketContext';
import useWebSocket from 'react-use-websocket'

const socketProtocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:')

var socketHost = window.location.hostname
var socketPort = 5000
if (window.location.hostname !== "localhost") {
  socketPort = process.env.REACT_APP_WS_PORT || socketPort
  socketHost = process.env.REACT_APP_WS_HOST || 'localhost'
}
var sessionId = ""
const socketUrl = `${socketProtocol}//${socketHost}:${socketPort}/ws`
const serverUrl = window.location.protocol + `//${socketHost}:${socketPort}/`

function App() {
  const [webSocket, setWebSocket] = useState(null);
  const webSocketEventEmitter = new WebSocketEventEmitter();

  // Here we fetch the sessionId if we don't already have one
  const { sendMessage, sendJsonMessage, lastMessage, readyState, getWebSocket } = useWebSocket(socketUrl, {
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
      if (j?.sessionId && sessionId === "") {
        sessionId = j.sessionId
        console.log("j.sessionId ", j.sessionId)
      }
      webSocketEventEmitter.emit('message', e);
    },
    onClose: (event) => {
      console.log(`App webSocket closed with code ${event.code} and reason '${event.reason}'`);
    },

  });

  return (
    <WebSocketContext.Provider value={{ webSocket, webSocketEventEmitter, sendJsonMessage }}>
      <Router>
        <Routes>
          <Route exact path="/" element={<Workflows/>} />
          <Route path="/authenticated" element={<Workflows/>} />
        </Routes>
      </Router>
    </WebSocketContext.Provider>
  );
}

export default App;
export { socketUrl, serverUrl, sessionId };
