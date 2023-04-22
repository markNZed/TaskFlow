/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, {useState, useEffect} from 'react';
import { QueryClientProvider, QueryClient } from 'react-query'; 
import { ReactQueryDevtools } from 'react-query/devtools'
import '../styles/App.css';
import '../styles/normal.css';
import SideMenu from "./SideMenu/SideMenu"
import ObjectDisplay from "./Generic/ObjectDisplay"
import Stack from '@mui/material/Stack';
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import { useGlobalStateContext } from '../contexts/GlobalStateContext';
import useFetchStart from '../hooks/useFetchStart';

const queryClient = new QueryClient()

// Move to taskStack ?
// Presentation task ?
// 

// Ultimately there could be multiple Workflows instantiated to allow for parallel workflows
// Here we can assume there is a single active workflow with a single active task
// We want to use a prop not a global for the task (so multiple Workflows can be supported)

function Taskflows() {
  const { globalState } = useGlobalStateContext();

  const [myStartTask, setMyStartTask] = useState();

  const [mobileViewOpen, setMobileViewOpen] = React.useState(false);

  const [fetchNow, setFetchNow] = useState();
  const { fetchResponse, fetched } = useFetchStart(fetchNow);

  const [DynamicComponent, setDynamicComponent] = useState(null);

  useEffect(() => {
    if (globalState.selectedTaskId && globalState.selectedTaskId !== myStartTask?.id) {
      setFetchNow(globalState.selectedTaskId)
    }
  }, [globalState]);

  useEffect(() => {
    if (fetchResponse) {
      setMyStartTask(fetchResponse)
    }
  }, [fetchResponse]);

  useEffect(() => {
    if (myStartTask?.ui_task && myStartTask.ui_task !== DynamicComponent?.name) {
      const loadComponent = async () => {
        try {
          // Assuming components are in the same folder
          const componentModule = await import(`./Tasks/${myStartTask.ui_task}`);
          setDynamicComponent(() => componentModule.default);
        } catch (error) {
          console.error(`Error loading component: ${myStartTask.ui_task}`, error);
          setDynamicComponent(null);
        }
        console.log("Loaded component ", DynamicComponent)
      };

      loadComponent();
    }
  }, [myStartTask]);

  
  const handleToggle = () => {
      setMobileViewOpen(!mobileViewOpen);
  };

  const drawWidth = 220;

  return (
    <QueryClientProvider client={queryClient}>
        <div className="App">
          <AppBar
            position="fixed"
            sx={{
                width: { sm: `calc(100% - ${drawWidth}px)` },
                ml: { sm: `${drawWidth}px` },
                backgroundColor: "grey",
            }}
          >
            <Toolbar>
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleToggle}
                sx={{ mr: 2, display: { sm: "none" } }}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6">
                Chat2Flow
              </Typography>
            </Toolbar>
          </AppBar>

          <Stack direction="row" spacing={3} sx={{ width: '100%', marginRight: '24px' }}>

            <Box
              component="nav"
              sx={{ width: { sm: drawWidth }, 
                  flexShrink: { sm: 0 } }}
            >
              <Drawer
                variant="temporary"
                open={mobileViewOpen}
                onClose={handleToggle}
                ModalProps={{
                    keepMounted: true,
                }}
                sx={{
                  display: { xs: "block", sm: "none" },
                  "& .MuiDrawer-paper": {
                    boxSizing: "border-box",
                    width: drawWidth,
                  },
                }}
              >
                <SideMenu />
              </Drawer>

              <Drawer
                variant="permanent"
                sx={{
                  display: { xs: "none", sm: "block" },
                  "& .MuiDrawer-paper": {
                    boxSizing: "border-box",
                    width: drawWidth,
                  },
                }}
                open
              >
                <SideMenu />
              </Drawer>

            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              
              <Toolbar />

              {DynamicComponent ? (
                <DynamicComponent startTask={myStartTask} setStartTask={setMyStartTask} />
              ) : 
              ''
              }

            </Box>

            <div className={`${globalState?.interface !== 'debug' ? 'hide' : ''}`}>
              <ObjectDisplay data={globalState.user} />
            </div>   

          </Stack>
        </div>

      <div className={`${globalState?.interface !== 'debug' ? 'hide' : ''}`}>
        { <ReactQueryDevtools 
        initialIsOpen={false}
        position='top-right'
        /> }
      </div>

    </QueryClientProvider>
  );
}

export default Taskflows;
