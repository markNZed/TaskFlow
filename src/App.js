import React from 'react';
import { QueryClientProvider, QueryClient } from 'react-query'; 
import { ReactQueryDevtools } from 'react-query/devtools'
import './styles/App.css';
import './styles/normal.css';
import ChatArea from "./components/ChatArea"
import SideMenu from "./components/SideMenu"
import { ModelProvider } from './contexts/ModelContext'
import useWebSocket from 'react-use-websocket'

const queryClient = new QueryClient()

const socketProtocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:')

var socketHost = window.location.hostname
var socketPort = 5000
if (window.location.hostname !== "localhost") {
  socketPort = process.env.REACT_APP_WS_PORT || 5000
  socketHost = process.env.REACT_APP_WS_HOST || 'localhost'
}
const socketUrl = `${socketProtocol}//${socketHost}:${socketPort}/ws`
const socketImg = window.location.protocol + `//${socketHost}:${socketPort}/1x1.png`
let sessionId = ""

function App() {

  useWebSocket(socketUrl, {
    onOpen: () => {
      console.log('WebSocket connection established.');
      //sendMessage('Here\'s some text that the server is urgently awaiting!'); 
    },
    // This will be replaced by the onMessage function in MsgBox
    onMessage: (e) => {
      //console.log('Message from server:', e.data)
      const j = JSON.parse(e.data)
      if (j?.sessionId && sessionId === "") {
        sessionId = j.sessionId
        console.log("j.sessionId ", j.sessionId)
      }
    },
    onClose: (event) => {
      console.log(`WebSocket closed with code ${event.code} and reason '${event.reason}'`);
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ModelProvider>
        <img src={ socketImg } alt="1 pixel"/>
        <div className="App">
          <SideMenu/>
          <ChatArea/>
        </div>
      </ModelProvider>

      { <ReactQueryDevtools 
      initialIsOpen={false}
      position='top-right'
      />
      }

   </QueryClientProvider>
    
  );
}

export default App;
export { socketUrl, sessionId };
