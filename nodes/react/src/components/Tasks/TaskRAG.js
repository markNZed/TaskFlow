/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useRef } from "react";
import withTask from "../../hoc/withTask";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";
import { Typography } from "@mui/material";
import { utils } from "../../utils/utils.mjs";
import DynamicComponent from "./../Generic/DynamicComponent";

/*
Task Function

This is intended to be a placeholder for experimenting with React
  
ToDo:
  
*/

const TaskRAG = (props) => {

  const {
    log,
    task,
    modifyTask,
    transition,
    childTasks,
    setChildTasksTask,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [responseText, setResponseText] = useState("");
  const responseTextRef = useRef("");
  const [socketResponses, setSocketResponses] = useState([]);

  // Each time this component is mounted then we reset the task state
  useEffect(() => {
    // This can write over the update
    task.state.current = "start";
    task.state.done = false;
  }, []);

  // This is asynchronous to the rendering so there may be conflicts where
  // state is updated during rendering and this impacts the parent
  // Probably needs to be moved outside of the component maybe into Redux
  useEffect(() => {
    const processResponses = () => {
      setSocketResponses((prevResponses) => {
        for (const response of prevResponses) {
          const text = response.partial.text;
          const mode = response.partial.mode;
          switch (mode) {
            case 'delta':
              responseTextRef.current += text;
              break;
            case 'partial':
            case 'final':
              responseTextRef.current = text;
              setResponseText(text);
              break;
            default:
              console.log("WARNING unknown mode : " + mode);
          }
        }
        //console.log(`${componentName} processResponses responseTextRef.current:`, responseTextRef.current);
        setResponseText(responseTextRef.current);
        return []; // Clear the processed responses
      });
    };
    if (socketResponses.length > 0) {
      processResponses();
    }
  }, [socketResponses]);

  // I guess the websocket can cause events during rendering
  // Putting this in the HoC causes a warning about setting state during rendering
  usePartialWSFilter(task,
    (partialTask) => {
      //console.log(`${componentName} usePartialWSFilter partialTask`, partialTask.response);
      setSocketResponses((prevResponses) => [...prevResponses, partialTask.response]);
    }
  )

  // Task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (props.transition()) { props.log(`${props.componentName} State Machine State ${task.state.current}`) }
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

  useEffect(() => {
    if (task?.input?.select) {
      const selectedModelVersion = task?.output?.chat?.services?.chat?.modelVersion;
      const hard = "gpt-4-0613";
      if (task?.input?.select && task.input.select[0] && task.input.select[0][0] === "thinkharder") {
        if (selectedModelVersion !== hard) {
          modifyTask({ 
            "command": "update", 
            "output.chat.services.chat.modelVersion": hard,
            "commandDescription": "Think harder",
          });
        }
      } else if (selectedModelVersion === hard) {
        modifyTask({ 
          "command": "update", 
          "output.chat.services.chat.modelVersion": "gpt-3.5-turbo-0613",
          "commandDescription": "Think softer",
        });
      }
    }
  }, [task?.input?.select]);

  return (
    <div>
      <div>
      {/* The component layout order is the order of task.meta.childrenIds which is the order the tasks are declared in the task configuration*/}
      {childTasks && childTasks.map((childTask, idx) => (
        <div key={"styling" + childTask.id} style={childTask?.config?.local?.style || {}}>
          <DynamicComponent
              key={childTask.id}
              is={childTask.type}
              task={childTask}
              setTask={(t) => setChildTasksTask(t, idx)} // Pass idx as an argument
              parentTask={task}
          />
        </div>
      ))}
      </div>
    </div>
  );
};

export default withTask(TaskRAG);
