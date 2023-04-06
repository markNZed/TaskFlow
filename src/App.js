import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import './styles/normal.css';
import Exercises from "./components/Exercises"

const socketProtocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:')

var socketHost = window.location.hostname
var socketPort = 5000
if (window.location.hostname !== "localhost") {
  socketPort = process.env.REACT_APP_WS_PORT || socketPort
  socketHost = process.env.REACT_APP_WS_HOST || 'localhost'
}
const socketUrl = `${socketProtocol}//${socketHost}:${socketPort}/ws`
const serverUrl = window.location.protocol + `//${socketHost}:${socketPort}/`
var sessionId = ""

function setSessionId(Id) {
  sessionId = Id
}

function App() {
  return (
    <Router>
      <Routes>
        <Route exact path="/" element={<Exercises/>} />
        <Route path="/authenticated" element={<Exercises/>} />
      </Routes>
    </Router>
  );
}

export default App;
export { socketUrl, serverUrl, sessionId, setSessionId };
