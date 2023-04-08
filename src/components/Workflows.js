import React, {useState, useEffect} from 'react';
import { QueryClientProvider, QueryClient } from 'react-query'; 
import { ReactQueryDevtools } from 'react-query/devtools'
import '../styles/App.css';
import '../styles/normal.css';
import ChatArea from "./Tasks/Chat/ChatArea"
import SideMenu from "./SideMenu"
import ObjectDisplay from "./ObjectDisplay"
import { ModelProvider } from '../contexts/ModelContext'
import Stack from '@mui/material/Stack';
import WorkflowStepper from "./WorkflowStepper"
import { serverUrl } from '../App';

const queryClient = new QueryClient()

function Workflows() {

  const [user, setUser] = useState([]);
  const [selectedworkflow, setSelectedworkflow] = useState({});
  
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

  function onSelectworkflow(workflow) {
    setSelectedworkflow(workflow);
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
            <SideMenu user={user} onSelectworkflow={onSelectworkflow} selectedworkflow={selectedworkflow}/>
            {selectedworkflow?.conversation ?
              <ChatArea user={user} selectedworkflow={selectedworkflow}/>
              :
              <WorkflowStepper user={user} selectedworkflow={selectedworkflow}/>
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

export default Workflows;
