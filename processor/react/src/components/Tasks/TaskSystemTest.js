/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import DynamicComponent from "../Generic/DynamicComponent";
import { useMachine } from '@xstate/react';
import { fsm } from '../../shared/fsm/TaskSystemTest/one';

// PLACEHOLDER - under development and not working

/*
Task Process

Task States
  
ToDo:
  
*/

function TaskSystemTest(props) {

  const {
    log,
    task,
    modifyTask,
    fsm,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  // without this we will not setup the hooks for the websocket
  props.onDidMount();

  //task.familyIds is an object with structure instanceId: {id: }

  const [state, send] = useMachine(fsm, {
    actions: {
      alertHi: () => {
        alertHiFunc()
      }
    }
  });

  useEffect(() => {
    if (task.state) {
      console.log("TaskSystemTest task.state", task.state);
    }
  }, [task.state]);

  function alertHiFunc() {
    alert("Hi");
  }

  /*
  useEffect(() => {
    send({
      type: 'DATA_CHANGED',
      data,
    });
  }, [data, send]);
  */
 //send('TOGGLE')
  
  return (
    <>
      {props.childTask && (
        <DynamicComponent
          key={props.childTask.id}
          is={props.childTask.type}
          task={props.childTask}
          setTask={props.setChildTask}
          parentTask={task}
          handleModifyChildTask={props.handleModifyChildTask}
        />
      )}
    </>
  );

};

export default withTask(TaskSystemTest);
