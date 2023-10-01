/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import JsonEditor from '../Generic/JsonEditor.js'
import { Button } from '@mui/material';
import { utils } from "../../utils/utils.mjs";

/*
Task Function

This is intended to be a placeholder for experimenting with React
  
ToDo:
  
*/

const TaskEdit = (props) => {
  const {
    log,
    task,
    modifyTask,
    transition,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [monitoredTask, setMonitoredTask] = useState();

  // Each time this component is mounted then we reset the task state
  useEffect(() => {
    // This can write over the update
    task.state.current = "start";
    task.state.done = false;
  }, []);

  // Task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        nextState = "input";
        break;
      case "input":
        if (task.input.monitorInstanceId) {
          modifyTask({
            "input": {},
            "request": task.input,
            "state.current": "monitorTask",
            "command": "update",
            "commandDescription": "Requesting monitoring " + task.input.action,
          });
        }
        // When submitting we do not want to copy task.response.monitoredTask into monitoredTask
        // Normally if task.response.monitoredTask is different from monitoredTask it is because
        // CEPMonitorInstance has updated task.response.monitoredTask
        if (task.input.submit && monitoredTask) {
          modifyTask({ 
            "response.monitoredTask": monitoredTask,
            "input": {},
            "command": "update",
            "commandArgs": {
              sync: true,
              syncTask: monitoredTask,
            },
            "commandDescription": `Sync the edited task ${monitoredTask.instanceId}`,
          });
        } else if (task?.response?.monitoredTask && monitoredTask && !utils.deepEqual(task.response.monitoredTask, monitoredTask)) {
          setMonitoredTask(task.response.monitoredTask);
        }
        break;
      case "monitorTask":
        // Waiting
        break;
      case "monitoringTask":
        setMonitoredTask(task.response.monitoredTask);
        nextState = "input";
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  const handleDataChanged = (newDataContainer) => {
    //console.log('handleDataChanged');
    if (newDataContainer && newDataContainer.json) {
      console.log('handleDataChanged setMonitoredTask', newDataContainer.json);
      setMonitoredTask(newDataContainer.json)
    }
  };

  const handleInstanceIdKeyPress = (event) => {
    if(event.key === 'Enter'){
      modifyTask({"input.monitorInstanceId": event.target.value});
    }
  };

  const handleTaskSubmit = () => {
    console.log("handleTaskSubmit");
    modifyTask({
      "input.submit": true,
    });
  };

  return (
    <div>
      <h1>JSON Editor</h1>
      <input 
        type="text" 
        onKeyDown={handleInstanceIdKeyPress}
        placeholder="Enter instanceId of monitoredTask"
        style={{width: "36ch"}}
      />
      {
        monitoredTask ? (
          <>
            <JsonEditor 
              content={monitoredTask} 
              onDataChanged={handleDataChanged}
              history={true}
              sortObjectKeys={true}
            />
            <Button type="primary" onClick={handleTaskSubmit}>Submit</Button>
          </>
        ) : (
          <p>No monitored task to display</p>
        )
      }
    </div>
  );
  
};

export default withTask(TaskEdit);
