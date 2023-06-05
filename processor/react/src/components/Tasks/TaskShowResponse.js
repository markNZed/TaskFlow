/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import { Typography } from "@mui/material";
import Paper from "@mui/material/Paper";
import withTask from "../../hoc/withTask";
import { replaceNewlinesWithParagraphs } from "../../utils/utils";

/*
Task Process
  This component is complete overkill for what it is doing but it was useful during early dev
  Fetches a response from the NodeJS Task Processor that is hard coded in the task
  
ToDo:
  
*/

const TaskShowResponse = (props) => {
  const {
    log,
    leaving,
    entering,
    task,
    setTask,
    parentTask,
    updateTask,
    updateState,
    stackPtr,
  } = props;

  const [responseText, setResponseText] = useState("");
  const [myTaskId, setMyTaskId] = useState();
  const [myLastState, setMyLastState] = useState("");

  // This is the level where we are going to use the task so set the stackPtr
  useEffect(() => {
    updateTask({ stackPtr: stackPtr });
  }, []);

  // Reset the task. Allows for the same component to be reused for different tasks.
  // Probably always better to associate a component with a single task.
  useEffect(() => {
    //console.log("task ", task)
    if (task && !myTaskId) {
      setMyTaskId(task.id);
      setResponseText("");
      if (!task.config?.nextStates) {
        // Default sequence is to just get response
        updateTask({
          "config.nextStates": { start: "response", response: "wait", wait: "stop" },
        });
        //setTask((p) => {return { ...p, steps: {'start' : 'response', 'response' : 'stop'} }});
      }
      updateState("start");
    }
  }, [task]);

  // Sub_task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (myTaskId && myTaskId === task.id) {
      const leaving_now =
        leaving?.direction === "next" && leaving?.task.name === task.name;
      const entering_now =
        entering?.direction === "prev" && entering?.task.name === task.name;
      const nextState = task.config.nextStates[task.state.current];
      let newState;
      log("TaskShowResponse State Machine State " + task.state.current + " nextState " + nextState)
      switch (task.state.current) {
        case "start":
          // Next state
          newState =  nextState;
          // Actions
          break;
        case "response":
          function response_action(text) {
            setResponseText(text);
          }
          // We cache the response React Task Processor side
          if (task.response?.text) {
            log("Response cached React Task Processor side");
            // Next state
            newState =  nextState;
            // Actions
            response_action(task.response.text);
          } else {
            // This effectively waits for the update
            if (task.response.updated) {
              newState =  nextState;
              let response_text;
              response_text = task.response.text;
              updateTask({ "response.text": response_text });
              //setTask((p) => {return {...p, response: response_text}});
              response_action(response_text);
            } else if (myLastState !== task.state.current) { // could introduce deltaState
              updateTask({ update: true });
            }
          }
          break;
        case "wait":
          if (leaving_now && !task.state.done) {
            updateTask({ "state.done": true });
            newState = nextState;
          }
          break;
        case "stop":
          // We may return to this Task and want to leave it again
          if (entering_now) {
            newState = "wait";
          }
          break;
        default:
          console.log("ERROR unknown state : " + task.state.current);
      }
      if (task.state.current !== newState) {
        if (newState) {
          updateState(newState);
        }
        // Could use delta instead?
        // Useful if we want an action only performed once on entering a state
        setMyLastState(task.state.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, task]);

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
    </div>
  );
};

export default withTask(TaskShowResponse);
