/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import { utils } from "../../utils/utils.mjs";
import JsonEditor from '../Generic/JsonEditor.js'


/*
Task Function

  Fetch any Task and modify it

  
ToDo:
  
*/

const TaskSystemUpdate = (props) => {
  const {
    log,
    task,
    modifyTask,
    transition,
  } = props;

  const [dummy, setDummy] = useState("");

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

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
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  const handleDataChanged = (dataContainer) => {
    console.log('Edited JSON data:', dataContainer);
    modifyTask(dataContainer.json);
  };

  return (
    <div>
      <h1>JSON Editor</h1>
      <JsonEditor content={task} onDataChanged={handleDataChanged} />
    </div>
  );
};

export default withTask(TaskSystemUpdate);
