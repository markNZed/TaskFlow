import React, {useState, useEffect} from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import './styles/normal.css';
import Workflows from "./components/Workflow/Workflows"
import { WebSocketProvider } from './contexts/WebSocketContext';
import { GlobalStateProvider } from './contexts/GlobalStateContext'
import { socketUrl } from './config';
import { useGeolocation } from './useGeolocation';

function App() {

  const { address, error : locationError } = useGeolocation();

  return (
    <GlobalStateProvider>
      <WebSocketProvider socketUrl={socketUrl} address={address}>
        <Router>
          <Routes>
            <Route exact path="/" element={<Workflows/>} />
            <Route path="/authenticated" element={<Workflows/>} />
          </Routes>
        </Router>
      </WebSocketProvider>
    </GlobalStateProvider>
  );
}

export default App;
