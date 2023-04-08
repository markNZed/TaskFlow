import React, {useState, useEffect} from 'react';
import { QueryClientProvider, QueryClient } from 'react-query'; 
import { ReactQueryDevtools } from 'react-query/devtools'
import '../styles/App.css';
import '../styles/normal.css';
import ChatArea from "./ChatArea"
import SideMenu from "./SideMenu"
import ObjectDisplay from "./ObjectDisplay"
import { ModelProvider } from '../contexts/ModelContext'
import Stack from '@mui/material/Stack';
import Workflow from "./Workflow"
import { serverUrl } from '../App';

const queryClient = new QueryClient()

function Exercises() {

  const [user, setUser] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState({});
  
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

  function onSelectExercise(exercise) {
    setSelectedExercise(exercise);
  }
  
  useEffect(() => {
    if (!window.location.href.includes('authenticated')) {
      window.location.replace(serverUrl + 'authenticate');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ModelProvider>
        <div className="App">
          <Stack direction="row" spacing={3} sx={{ width: '100%', marginRight: '24px' }}>
            <SideMenu user={user} onSelectExercise={onSelectExercise} selectedExercise={selectedExercise}/>
            {selectedExercise?.conversation ?
              <ChatArea user={user} selectedExercise={selectedExercise}/>
              :
              <Workflow user={user} selectedExercise={selectedExercise}/>
            }
            <div className={`${user?.interface !== 'debug' ? 'hide' : ''}`}>
              <ObjectDisplay data={user} />
            </div>   
          </Stack>
        </div>
      </ModelProvider>

      <div className={`${user?.interface === 'simple' ? 'hide' : ''}`}>
        { <ReactQueryDevtools 
        initialIsOpen={false}
        position='top-right'
        /> }
      </div>

    </QueryClientProvider>
  );
}

export default Exercises;
