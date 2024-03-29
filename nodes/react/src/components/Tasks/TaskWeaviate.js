/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import TextField from '@mui/material/TextField';
import { sendTo } from "xstate/lib/actions";

/*
Task Function

This is intended to be a placeholder for experimenting with React
  
ToDo:
  
*/

const TaskWeaviate = (props) => {

  const {
    log,
    task,
    modifyTask,
    transition,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [question, setQuestion] = useState("");  // State for the question input

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
    if (props.transition()) { props.log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        nextState = "input";
        break;
      case "input":
        if (task.input.submit) {
          modifyTask({
            "input.submit": false,
            "state.current": "sent",
            "command": "update",
          });
        }
        break;
      case "sent":
        break;
      case "response":
        nextState = "input";
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  const handleChange = (e) => {
    setQuestion(e.target.value);
    console.log("question: ", e.target.value);
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      modifyTask({
        "input.submit": true,
        "input.question": question,
      });
    }
  }

  const DisplayObject = ({ obj, level = 0 }) => {
    const indent = 10 * level; // 40px indentation for each level
    if (!obj) {
      return null;
    }
    return (
      <ul style={{ textAlign: 'left', marginLeft: `${indent}px` }}>
        {Object.keys(obj).map((key, index) => (
          <li key={index}>
            {key}:{" "}
            {typeof obj[key] === "object" ? (
              <DisplayObject obj={obj[key]} level={level + 1} />
            ) : (
              obj[key]
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <h1>TaskWeaviate</h1>
      <TextField
        label="Enter your question"
        variant="outlined"
        value={question}
        onChange={handleChange}
        onKeyDown={handleKeyDown}  // Detect "Enter" key press
      />
      <DisplayObject obj={task?.response?.answer} />;
    </div>
  );
};

export default withTask(TaskWeaviate);
