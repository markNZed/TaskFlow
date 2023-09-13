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
import { utils } from "../../utils/utils.mjs";

// PLACEHOLDER - under development and not working

/*
Task Function

Task States
  
ToDo:

*/

function TaskSystemMenu(props) {

  const {
    log,
    task,
    modifyTask,
    onDidMount,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  const { globalState, replaceGlobalState } = useGlobalStateContext();
  const [mobileViewOpen, setMobileViewOpen] = useState(false);
  const [drawWidth, setDrawWidth] = useState(220);
  const [tasksTree, setTasksTree] = useState([]);

  // Task state machine
  useEffect(() => {
    // modifyState may have been called by not yet updated test.state.current
    if (!props.checkIfStateReady()) {return}
    let nextState; 
    // Log each transition, other events may cause looping over the same state
    if (props.transition()) { log(`${props.componentName} State Machine State ${task.state.current} ${task.state.last}`) }
    switch (task.state.current) {
      case "start":
        break;
      case "loaded":
        setTasksTree(task.state.tasksTree);
        replaceGlobalState("tasksTree", task.state.tasksTree); // mergeGlobalState did not delete ?
        //console.log("task.state.tasksTree", task.state.tasksTree);
        modifyTask({
          "command": "update",
          "state.current" : "ready"
        });
        break;
      case "ready":
        if (!utils.deepEqual(task.state.tasksTree, tasksTree)) {
          //console.log("task.state.tasksTree", task.state.tasksTree);
          setTasksTree(task.state.tasksTree);
          replaceGlobalState("tasksTree", task.state.tasksTree); // mergeGlobalState did not delete ?
        }
        break;
      default:
        console.log(`${props.componentName} State Machine unknown state:`, task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, tasksTree]);

  const handleToggle = () => {
    console.log("TaskSystemMenu handleToggle");
    setMobileViewOpen(!mobileViewOpen);
  };

  useEffect(() => {
    if (task?.input?.mobileViewOpenToggle) {
      setMobileViewOpen(!mobileViewOpen);
      modifyTask({
        "input.mobileViewOpenToggle": null
      })
    }
  }, [task]);

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
