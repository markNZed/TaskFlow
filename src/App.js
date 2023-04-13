import React, {useEffect} from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles/App.css';
import './styles/normal.css';
import Workflows from "./components/Workflow/Workflows"
import { useGeolocation } from './useGeolocation';
import { useGlobalStateContext } from './contexts/GlobalStateContext';


function App() {
  const { address } = useGeolocation();
  const { updateGlobalState } = useGlobalStateContext();

  useEffect(() => {
    if (address) {
      updateGlobalState({
        address: address,
      })
    }
  }, [address, updateGlobalState]);

  return (
    <Routes>
      <Route exact path="/" element={<Workflows/>} />
      <Route path="/authenticated" element={<Workflows/>} />
    </Routes>
  );
}

export default App;
