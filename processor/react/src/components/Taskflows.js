/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useState, useEffect, useCallback } from "react";
import "../styles/App.css";
import "../styles/normal.css";
import SideMenu from "./SideMenu/SideMenu";
import ObjectDisplay from "./Generic/ObjectDisplay";
import Stack from "@mui/material/Stack";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import DynamicComponent from "./Generic/DynamicComponent";
import withTask from "../hoc/withTask";
import { setArrayState } from "../utils/utils";
import { appLabel } from "../config";

// If there is only one agent then do not show side menu

function Taskflows(props) {
  const {
    setTask,
    useTasksState,
    startTaskError,
    startTask,
    stackPtr,
  } = props;

  const { globalState, replaceGlobalState } = useGlobalStateContext();
  const [tasks, setTasks] = useTasksState([]);
  // We maintain a list of tasksIds so we can quickly find the relevant task
  // if it has been previousyl created in tasks
  const [tasksIds, setTasksIds] = useState([]);
  const [tasksStackId, setTasksStackId] = useState([]);
  const [tasksIdx, setTasksIdx] = useState(0);
  const [title, setTitle] = useState(appLabel);
  const [hideSide, setHideSide] = useState(false);
  const [drawWidth, setDrawWidth] = useState(220);

  const [mobileViewOpen, setMobileViewOpen] = React.useState(false);

  useEffect(() => {
    if (globalState.selectedTaskId && 
        (tasksIds.length === 0 || globalState.selectedTaskId !== tasksIds[tasksIdx])
    ) {
      const selectedTaskId = globalState.selectedTaskId
      const start = selectedTaskId + ".start";
      const index = tasksIds.indexOf(start);
      if (index === -1) {
        // Could/should us the stackTaskId
        const taskStackId = globalState.taskflowsTree[selectedTaskId].stackTaskId;
        setTask({
          stackPtr: 0,
          command: "start",
          commandArgs: {
            id: taskStackId[0],
            stackPtr: 1,
          }
        });
        setTasksStackId((p) => [...p, taskStackId]);
        console.log("Taskflows start", taskStackId)
      } else {
        setTasksIdx(index);
      }
      setTitle(globalState.taskflowsTree[selectedTaskId].label);
      replaceGlobalState("selectedTaskId", null);
    }
    // If we only have one start task and the Processor has registered with the hub
    if (globalState?.taskflowLeafCount && globalState.taskflowLeafCount === 1 && !globalState?.hubId) {
      const sortedKeys = Object.keys(globalState.taskflowsTree).sort(
        (a, b) => a.length - b.length
      );
      const longestKey = sortedKeys[sortedKeys.length - 1];
      setTask({
        stackPtr: 0,
        command: "start",
        commandArgs: {
          id: globalState.taskflowsTree[longestKey].id + ".start",
          stackPtr: 1,
        }
      });
      setHideSide(true);
      setDrawWidth(0);
    }
  }, [globalState]);

  useEffect(() => {
    if (startTask) {
      setTasksIdx(tasks.length);
      setTasks((prevVisitedTasks) => [...prevVisitedTasks, startTask]);
      setTasksIds((p) => [...p, startTask.id]);
    }
  }, [startTask]);

  const handleToggle = () => {
    setMobileViewOpen(!mobileViewOpen);
  };

  /*
  function setTasksTask(t, idx) {
    setArrayState(setTasks, idx, t);
  }
  */

  const setTasksTask = useCallback((t, idx) => {
    // This is a hack to push updates outside of the rendering 
    // The websocket is asynchronous so it can create calls during rendering
    // Also passing the task and setTask down means that during the rendering of Taskflows
    // DynamicComponents can call setTask which is aliased to setTasksTask
    // Maybe Redux is the way to work around this
    setTimeout(() => setArrayState(setTasks, idx, t), 0);
    //setArrayState(setTasks, idx, t)
  }, [setArrayState]);

  //Tracing

  useEffect(() => {
    //console.log("Tasks ", tasks, tasksIdx)
  }, [tasks]);

  return (
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
          <Typography variant="h6">{title}</Typography>
        </Toolbar>
      </AppBar>

      <Stack
        direction="row"
        spacing={3}
        sx={{ width: "100%", marginRight: "24px" }}
      >
        <Box
          component="nav"
          sx={{
            width: { sm: drawWidth },
            flexShrink: { sm: 0 },
            ...(hideSide && { display: "none" }),
          }}
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
            <SideMenu onClose={handleToggle} />
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
            <SideMenu onClose={() => (null)} />
          </Drawer>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <Toolbar />
          {tasks.map(
            ({ stack, instanceId }, idx) =>
              stack && (
                <div
                  key={`unique${instanceId}`}
                  className={`${tasksIdx !== idx ? "hide" : "flex-grow"}`}
                >
                  <DynamicComponent
                    key={instanceId}
                    is={stack[0]}
                    task={tasks[idx]}
                    setTask={(t) => setTasksTask(t, idx)} // Pass idx as an argument
                    parentTask={null}
                    stackPtr={stackPtr}
                    stackTaskId={tasksStackId[idx]}
                  />
                </div>
              )
          )}
          <div className={`${globalState.user?.interface !== "debug" ? "hide" : ""}`}>
            <ObjectDisplay data={globalState} />
          </div>
        </Box>

      </Stack>
    </div>
  );
}

export default withTask(Taskflows);
