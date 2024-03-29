/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useState, useEffect, useCallback, useRef } from "react";
import "../styles/App.css";
import "../styles/normal.css";
import ObjectDisplay from "./Generic/ObjectDisplay";
import Stack from "@mui/material/Stack";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import DynamicComponent from "./Generic/DynamicComponent";
import withTask from "../hoc/withTask";
import { utils } from "../utils/utils.mjs";
import IFrame from './Generic/IFrame.js'
import Loading from "./Loading";

// If there is only one agent then do not show side menu

function Taskflows(props) {
  const {
    task,
    modifyTask,
    setTask,
    useTasksState,
    startTaskError,
    startTask,
    reinitialize,
  } = props;

  const { globalState, setGlobalStateEntry } = useGlobalStateContext();
  const [tasks, setTasks] = useTasksState([]);
  // We maintain a list of tasksIds so we can quickly find the relevant task
  // if it has been previousyl created in tasks
  const [tasksIds, setTasksIds] = useState([]);
  const [taskInstanceIds, setTaskInstanceIds] = useState([]);
  const [tasksIdx, setTasksIdx] = useState(0);
  const [title, setTitle] = useState(globalState.appLabel);
  const [hideSide, setHideSide] = useState(false);
  const [drawWidth, setDrawWidth] = useState(0);
  const [counter, setCounter] = useState(0);
  const [taskMenu, setTaskMenu] = useState();
  const [loading, setLoading] = useState(true);

  props.onDidMount();

  useEffect(() => {
    const selectedTaskId = globalState.selectedTaskId
    if (selectedTaskId) {
      /*
      // For now we are loading a new instance instead of reseting (resetting requires coordinating nodes)
      // The counter is used in the key of the component
      // If it chenages then this can "reset" the Task as it will be re-mounted.
      // This only happens if we click on the task in the menu while using the same task
      if (selectedTaskId === tasksIds[tasksIdx]) {
        setCounter(prevCounter => prevCounter + 1);
        setTaskInstanceIds(prevTaskInstanceIds => {
          const updated = [...prevTaskInstanceIds];
          updated[tasksIdx] = updated[tasksIdx] + counter;
          return updated;
        });
      }
      */
      const start = selectedTaskId;
      const index = tasksIds.indexOf(start);
      // If we select a task in the menu while using it then start the task again (new instanceId)
      if (index === -1 || selectedTaskId === tasksIds[tasksIdx]) {
        if (selectedTaskId === tasksIds[tasksIdx]) {
          // Remove the instanceId so it will not be rendered (see conditional in the returned jsx)
          const t = JSON.parse(JSON.stringify(tasks[tasksIdx]));
          delete t.instanceId;
          utils.setArrayState(setTasks, tasksIdx, t)
        }
        modifyTask({
          command: "start",
          commandArgs: {
            id: selectedTaskId,
          },
          commandDescription: `Task ${selectedTaskId} selected in menu`,
        });
        console.log("Taskflows start", selectedTaskId)
      } else {
        setTasksIdx(index);
      }
      setTitle(globalState.tasksTree[selectedTaskId].label);
      setGlobalStateEntry("selectedTaskId", null);
      setGlobalStateEntry("lastSelectedTaskId", selectedTaskId);
      setGlobalStateEntry("maxWidth", globalState.maxWidthDefault);
      setGlobalStateEntry("xStateDevTools", false);
      setLoading(true);
    }
    // If we only have one start task
    const taskflowLeafCount = globalState?.taskflowLeafCount;
    if (taskflowLeafCount === 1) {
      if (selectedTaskId) {
        modifyTask({
          command: "start",
          commandArgs: {
            id: selectedTaskId,
          },
          commandDescription: "Start the only task",
        });
        setHideSide(true);
        setDrawWidth(0);
      }
    } else if (taskflowLeafCount > 1) {
      // Once the menu is ready it will have set taskflowLeafCount
      // This avoids a glitch of defaulting to 220 and it shrinking to 0 if the menu has only one item
      setDrawWidth(220);
    }
  }, [globalState]);

  // Task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (props.transition()) { props.log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        if (startTask) {
          if (startTask.id === task?.config?.local?.menuId) {
            if (!taskMenu) {
              setTaskMenu(startTask);
              setGlobalStateEntry("user", startTask.user);
              setLoading(false);
            }
          } else if (!taskInstanceIds.includes(startTask.instanceId)) {
            console.log("selectMenu started", startTask.id);
            setTasksIdx(tasks.length);
            setTasks((prevVisitedTasks) => [...prevVisitedTasks, startTask]);
            setTasksIds((p) => [...p, startTask.id]);
            setTaskInstanceIds((p) => [...p, startTask.instanceId]);
            setLoading(false);
          }
        }  
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, startTask, globalState.nodeId]);

  const handleToggle = () => {
    setTaskMenu((p) => ({...p, input: {"mobileViewOpenToggle": true}}));
  };

  /*
  function setTasksTask(t, idx) {
    utils.setArrayState(setTasks, idx, t);
  }
  */

  const setTasksTask = useCallback((t, idx) => {
    // This is a hack to push updates outside of the rendering 
    // The websocket is asynchronous so it can create calls during rendering
    // Also passing the task and setTask down means that during the rendering of Taskflows
    // DynamicComponents can call setTask which is aliased to setTasksTask
    // Maybe Redux is the way to work around this
    setTimeout(() => utils.setArrayState(setTasks, idx, t), 0);
    //utils.setArrayState(setTasks, idx, t)
  }, [utils.setArrayState]);

  //Tracing

  useEffect(() => {
    //console.log("startTask ", startTask, task?.state?.current, task?.config?.local?.menuId);
  }, [startTask]);

  useEffect(() => {
    // Flushing all this is very close to simply reloading the page
    setTaskMenu(null);
    setTasksIdx(0);
    setTasks([]);
    setTasksIds([]);
    setTaskInstanceIds([]);
  }, [reinitialize]);

  return (
    <div className="App" style={{maxWidth: globalState.maxWidth}}>
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
        sx={{ width: "100%" }}
      >
        <Box
          component="nav"
          sx={{
            width: { sm: drawWidth },
            flexShrink: { sm: 0 },
            ...(hideSide && { display: "none" }),
            overflowY: "auto",
          }}
        >
          {taskMenu && (
            <DynamicComponent
              key={taskMenu.instanceId}
              is={taskMenu.type}
              task={taskMenu}
              setTask={setTaskMenu}
              parentTask={null}
            />
          )}
        </Box>

        <Box 
          sx={{ 
            display: "flex", 
            flexDirection: "column", 
            flexGrow: 1,
            overflowY: "auto",
          }}
        >
          <Toolbar />
          {tasks.map(
            ({ instanceId }, idx) =>
              instanceId && 
              (
                <div
                  key={taskInstanceIds[idx]}
                  className={`${tasksIdx !== idx ? "hide" : "flex-grow"}`}
                >
                  <DynamicComponent
                    key={instanceId}
                    is={tasks[idx].type}
                    task={tasks[idx]}
                    setTask={(t) => setTasksTask(t, idx)} // Pass idx as an argument
                    parentTask={null}
                  />
                </div>
              )
          )}
          {loading && (
            <Loading />
          )}
          <div className={`${globalState.user?.interface !== "debug" ? "hide" : ""}`}>
            <ObjectDisplay data={globalState} />
          </div>
          <IFrame />
        </Box>

      </Stack>
    </div>
  );
}

export default withTask(Taskflows);
