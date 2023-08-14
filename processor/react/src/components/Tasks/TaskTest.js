/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import { useMachine } from '@xstate/react';
import { createMachine } from 'xstate';

// PLACEHOLDER - under development and not working

/*
Task Process

Task States
  
ToDo:

*/

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

function TaskTest(props) {

  const [state, setState] = useMachine(toggleMachine);

  return (
    <div>
      <button onClick={() => setState('TOGGLE')}>
        {state.value === 'inactive'
          ? 'Click to activate'
          : 'Active! Click to deactivate'}
      </button>
    </div>
  );

};

export default withTask(TaskTest);
