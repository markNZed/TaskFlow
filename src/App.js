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
const socketUrl = socketProtocol + '//' + window.location.hostname + ':5000/'
const socketRoot = window.location.protocol + '//' + window.location.hostname + ':5000/'
const socketImgUrl = socketRoot + '1x1.png'
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
      if (j?.sessionId) {
        sessionId = j.sessionId
        console.log("j.sessionId ", j.sessionId)
      }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ModelProvider>
        <img src={`${socketImgUrl}`} alt="Protocol check" onError={() => alert(`Invalid HTTPS certificate visit ${socketRoot}`)} />
        <div className="App">
          <SideMenu/>
          <ChatArea/>
        </div>
      </ModelProvider>

      <ReactQueryDevtools 
      initialIsOpen={false}
      position='top-right'
      />

   </QueryClientProvider>
    
  );
}

export default App;
export { socketUrl, sessionId };
