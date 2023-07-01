/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useRef } from "react";
import { Typography } from "@mui/material";
import Paper from "@mui/material/Paper";
import withTask from "../../hoc/withTask";
import DynamicComponent from "./../Generic/DynamicComponent";
import { replaceNewlinesWithParagraphs } from "../../utils/utils";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";

/*
Task Process
  
ToDo:

*/

const TaskGeneratePersona = (props) => {
  const {
    log,
    task,
    setTask,
    startTaskError,
    startTask,
    startTaskFn,
    stackPtr,
    modifyTask,
    useTaskState,
    transition,
    onDidMount,
    componentName,
    childTask,
    setChildTask
  } = props;

  const [responseText, setResponseText] = useState("");
  const responseTextRef = useRef("");
  const [socketResponses, setSocketResponses] = useState([]);

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  // Note that socketResponses may not (will not) be updated on every websocket event
  // React groups setState operations and I have not understood the exact criteria for this
  useEffect(() => {
    const processResponses = () => {
      setSocketResponses((prevResponses) => {
        //console.log("prevResponses.lenght", prevResponses.length);
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
              break;
          }
        }
        //console.log("TaskChat processResponses responseTextRef.current:", responseTextRef.current);
        setResponseText(responseTextRef.current);
        return []; // Clear the processed socketResponses
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
      //console.log("TaskChat usePartialWSFilter partialTask", partialTask.response);
      setSocketResponses((prevResponses) => [...prevResponses, partialTask.response]);
    }
  )
  
  // Task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log(`${componentName} State Machine State ` + task.state.current) }
    switch (task.state.current) {
      case "start":
        // We are waiting so NodeJS can generate the persona
        setResponseText(task.config.response);
        break;
      case "generated":
        setResponseText(task.output.summary);
        startTaskFn(props.stackTaskId[stackPtr], task.familyId, stackPtr + 1);
        nextState = "wait";
      case "wait":
      default:
        console.log("Default state : " + task.state.current);
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  useEffect(() => {
    if (startTask) {
      setChildTask(startTask);
    }
  }, [startTask]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Paper
        elevation={3}
        style={{
          overflow: "auto",
          textAlign: "justify",
          padding: "16px",
        }}
      >
        {responseText && responseText.split("\\n").map((line, index) => (
          <Typography 
            style={{ marginTop: "16px" }} 
            key={index}
            className="text2html"
            dangerouslySetInnerHTML={{ __html: replaceNewlinesWithParagraphs(line) }}
          />
        ))}
      </Paper>
      {childTask ? (
        <div className="flex-grow">
          <DynamicComponent
            key="childTask"
            is={childTask.stack[stackPtr]}
            task={childTask}
            setTask={setChildTask}
            parentTask={task}
            stackPtr={stackPtr}
            stackTaskId={props.stackTaskId}
          />
        </div>
      ) : (
        ""
      )}
    </div>
  );
};

export default withTask(TaskGeneratePersona);
