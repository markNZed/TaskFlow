/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import SideMenu from "../SideMenu/SideMenu";
import useGlobalStateContext from "../../contexts/GlobalStateContext";
import Drawer from "@mui/material/Drawer";

// PLACEHOLDER - under development and not working

/*
Task Process

Task States
  
ToDo:

*/

function TaskSystemMenu(props) {

    const { globalState } = useGlobalStateContext();
    const [mobileViewOpen, setMobileViewOpen] = useState(false);
    const [drawWidth, setDrawWidth] = useState(220);

    const handleToggle = () => {
        setMobileViewOpen(!mobileViewOpen);
      };

    return (
      <>
        <div style={{ width: '100%', height: '100%' }}>
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
                position: 'relative', // override fixed position
              },
            }}
          >
            <SideMenu onClose={handleToggle} interfaceType={globalState.user?.interface} />
          </Drawer>

          <Drawer
            variant="permanent"
            sx={{
              display: { xs: "none", sm: "block" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: drawWidth,
                position: 'relative', // override fixed position
              },
            }}
            open
          >
            <SideMenu onClose={() => (null)}  interfaceType={globalState.user?.interface}/>
          </Drawer>
        </div>
      </>  
    )
    
}

export default withTask(TaskSystemMenu);
