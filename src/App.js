import React, {useEffect, useState} from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles/App.css';
import './styles/normal.css';
import Workflows from "./components/Workflow/Workflows"
import { useGeolocation } from './useGeolocation';
import { useGlobalStateContext } from './contexts/GlobalStateContext';
import { serverUrl } from './config';

function App() {
  const [enableGeolocation, setEnableGeolocation] = useState(false);
  const { address } = useGeolocation(enableGeolocation);
  const { globalState, mergeGlobalState } = useGlobalStateContext();
  
  useEffect(() => {
    if (globalState?.workflow?.use_address && !enableGeolocation) {
      setEnableGeolocation(true)
      console.log("Enabling use of address")
    }
  }, [globalState]);

  useEffect(() => {
    if (address) {
      mergeGlobalState({ address });
    }
  }, [address]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`${serverUrl}api/session`, { credentials: 'include' });
        const data = await response.json();
        const user = data.user
        mergeGlobalState({ user });
        console.log("Set user: ", user);
        if (!globalState?.sessionId) {
          const sessionId = data.sessionId
          mergeGlobalState({ sessionId });
          console.log("Set sessionId ", sessionId);
        }
        if (data?.workflows) {
          const workflows = data.workflows
          mergeGlobalState({ workflows });
        }
      } catch (err) {
        console.log(err.message);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    console.log("globalState ", globalState)
  }, [globalState]);

  return (
    <Routes>
      <Route exact path="/" element={<Workflows/>} />
      <Route path="/authenticated" element={<Workflows/>} />
    </Routes>
  );
}

export default App;
