/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import { useMachine } from '@xstate/react';
import { fsm } from '../../shared/fsm/TaskTest/one';

// PLACEHOLDER - under development and not working

/*
Task Process

Task States
  
ToDo:
  
*/

function TaskTest(props) {

  const {
    log,
    task,
    modifyTask,
    fsm,
  } = props;

  const [state, send] = useMachine(fsm, {
    actions: {
      alertHi: () => {
        alertHiFunc()
      }
    }
  });

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
  
  return (
    <>
      <div>
        <button onClick={() => send('TOGGLE')}>
          {state.value === 'inactive'
            ? 'Click to activate'
            : 'Active! Click to deactivate'}
        </button>
      </div>
      <div>
        {state.matches('resolved') && <p>Loading...</p>}
      </div>
    </>
  );

};

export default withTask(TaskTest);
