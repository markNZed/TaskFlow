import React, {useState, useEffect} from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import './styles/normal.css';
import Workflows from "./components/Workflow/Workflows"
import { WebSocketProvider } from './contexts/WebSocketContext';
import { GlobalStateProvider } from './contexts/GlobalStateContext'
import { socketUrl } from './config';

function App() {
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
        },
        error => {
          console.error(error);
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
    }
  }, []);

  useEffect(() => {
    if (location) {
      const reverse_lookup = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}&zoom=18&addressdetails=1`
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
    }
  }, [location]);

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
