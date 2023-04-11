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
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });

          const reverse_lookup = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`

          async function fetchData(reverse_lookup) { 
            let result = await fetch(reverse_lookup)
            .then((response) => response.json())
            .catch((err) => {
                console.log(err.message);
            });
            if (result?.display_name) {
              return result.display_name
            } else {
              return ''
            }
          }

          fetchData(reverse_lookup).then((address) => {
            setAddress(address)
            console.log("Address set " + address)
          })
          
        },
        error => {
          console.error(error);
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
    }
  }, []);

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

  const sendJsonMessagePlus = function(m) {
    m.address = address
    sendJsonMessage(m)
  }

  return (
    <WebSocketContext.Provider value={{ webSocket, webSocketEventEmitter, sendJsonMessagePlus }}>
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
