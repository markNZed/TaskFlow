import React, {useState, useEffect} from 'react';
import { QueryClientProvider, QueryClient } from 'react-query'; 
import { ReactQueryDevtools } from 'react-query/devtools'
import '../../styles/App.css';
import '../../styles/normal.css';
import ChatArea from "./Tasks/Chat/ChatArea"
import SideMenu from "../SideMenu/SideMenu"
import ObjectDisplay from "../Generic/ObjectDisplay"
import Stack from '@mui/material/Stack';
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import WorkflowStepper from "./WorkflowStepper"
import { serverUrl } from '../../config';
import { useGlobalStateContext } from '../../contexts/GlobalStateContext';


const queryClient = new QueryClient()

function Workflows() {

  const { globalState } = useGlobalStateContext();

  const [selectedworkflow, setSelectedworkflow] = useState({});
  const [mobileViewOpen, setMobileViewOpen] = React.useState(false);
  
  const handleToggle = () => {
      setMobileViewOpen(!mobileViewOpen);
  };

  function onSelectworkflow(workflow) {
    setSelectedworkflow(workflow);
  }
  
  useEffect(() => {
    if (!window.location.href.includes('authenticated')) {
      window.location.replace(serverUrl + 'authenticate');
    }
  }, []);

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
                UnderStudy
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
                <SideMenu onSelectworkflow={onSelectworkflow} selectedworkflow={selectedworkflow}/>
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
                <SideMenu onSelectworkflow={onSelectworkflow} selectedworkflow={selectedworkflow}/>
              </Drawer>

            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              
              <Toolbar />

              {/* We default to the WorkflowStepper to run the Workflow*/}
              {selectedworkflow?.kernel === 'chat' ?
                <ChatArea selectedworkflow={selectedworkflow}/>
                :
                <WorkflowStepper selectedworkflow={selectedworkflow}/>
              }

            </Box>

            <div className={`${globalState?.interface !== 'debug' ? 'hide' : ''}`}>
              <ObjectDisplay data={globalState.user} />
            </div>   

          </Stack>
        </div>

      <div className={`${globalState?.interface === 'simple' ? 'hide' : ''}`}>
        { <ReactQueryDevtools 
        initialIsOpen={false}
        position='top-right'
        /> }
      </div>

    </QueryClientProvider>
  );
}

export default Workflows;
