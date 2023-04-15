import React, {useEffect, useState} from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles/App.css';
import './styles/normal.css';
import Workflows from "./components/Workflow/Workflows"
import { useGeolocation } from './useGeolocation';
import { useGlobalStateContext } from './contexts/GlobalStateContext';
import { serverUrl } from './config';

function App() {
  const { address } = useGeolocation();
  const { updateGlobalState } = useGlobalStateContext();
  const [user, setUser] = useState([]);

  useEffect(() => {
    if (address) {
      updateGlobalState({
        address: address,
      })
    }
  }, [address, updateGlobalState]);

  useEffect(() => {
    fetch(`${serverUrl}api/user`, {
      credentials: 'include'
    })
    .then((response) => response.json())
    .then((data) => {
      setUser(data);
      console.log("Set user: " + JSON.stringify(data));
    })
    .catch((err) => {
      console.log(err.message);
    });
  }, []);

  useEffect(() => {
    if (address) {
      updateGlobalState({
        user: user,
      })
    }
  }, [user, updateGlobalState]);



  return (
    <Routes>
      <Route exact path="/" element={<Workflows/>} />
      <Route path="/authenticated" element={<Workflows/>} />
    </Routes>
  );
}

export default App;
