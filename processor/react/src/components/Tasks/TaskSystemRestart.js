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

This is intended to be a placeholder for experimenting with React
  
ToDo:
  
*/

const TaskSystemRestart = (props) => {
  const {
    task,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  useEffect(() => {
    window.location.reload();
  }, []);

  return (
    <div>
      <h1>Restarting</h1>
    </div>
  );
};

export default withTask(TaskSystemRestart);
