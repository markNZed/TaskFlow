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
import { utils } from "../../utils/utils.mjs";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";

/*
Task Function
  
ToDo:

*/

const TaskGeneratePersona = (props) => {
  const {
    log,
    task,
    setTask,
    startTaskError,
    startTask,
    modifyTask,
    useTaskState,
    transition,
    componentName,
    childTask,
    setChildTask
  } = props;

  const [responseText, setResponseText] = useState("");
  const [startedConversation, setStartedConversation] = useState(false);
  const responseTextRef = useRef("");
  const [socketResponses, setSocketResponses] = useState([]);

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

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
        setResponseText(task.config.local.display);
        break;
      case "generated":
        // Without startedConversation we can receive an update (e.g. the children count) that causes
        // a transition back into state generated. The sync can have this effect if state is modified.
        if (!startedConversation) {
          setResponseText(task.output.summary);
          const startTaskId = props.task.meta.childrenId[0];
          modifyTask({
            "command": "start",
            "commandArgs": {
              id: startTaskId,
            }
          });
          setStartedConversation(true);
        }
        nextState = "wait";
        break;
      case "wait":
        if (transition()) {
          // We want to get all the Processors into the wait state
          modifyTask({
            "command": "update",
            "commandDescription": "Transition state to wait",
          });
        }
        break;
      default:
        console.log(`${componentName} Default state: ${task.state.current}`);
    }
    // Manage state.current
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
            dangerouslySetInnerHTML={{ __html: utils.replaceNewlinesWithParagraphs(line) }}
          />
        ))}
      </Paper>
      {childTask ? (
        <div className="flex-grow">
          <DynamicComponent
            key="childTask"
            is={childTask.type}
            task={childTask}
            setTask={setChildTask}
            parentTask={task}
          />
        </div>
      ) : (
        ""
      )}
    </div>
  );
};

export default withTask(TaskGeneratePersona);
