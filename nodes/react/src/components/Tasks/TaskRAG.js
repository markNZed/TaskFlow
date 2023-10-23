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
    childTask
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [query, setQuery] = useState("");  // State for the query input
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
        setResponseText(task?.response?.result);
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
    setQuery(e.target.value);
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); 
      modifyTask({
        "input.submit": true,
        "input.query": query,
      });
      setResponseText("");
      responseTextRef.current = "";
      console.log("query", query);
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
    <div style={{ textAlign: 'left', marginLeft: `24px`, width: '100%', maxWidth: '800px' }}>
      <h1>{task.config.label}</h1>
      <textarea
        placeholder={task.config?.local?.inputLabel}
        label="Enter your query"
        variant="outlined"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}  // Detect "Enter" key press
      />
      <div>
        {responseText ? (
          responseText.split("\\n").map((line, index) => (
            <Typography 
              style={{ marginTop: "16px" }} 
              key={index}
              className="text2html"
              dangerouslySetInnerHTML={{ __html: utils.replaceNewlinesWithParagraphs(line) }}
            />
          ))
        ) : (
          ""
        )}
      </div>
      
      <div>
        {childTask && (
          <DynamicComponent
            key={childTask.id}
            is={childTask.type}
            task={childTask}
            setTask={props.setChildTask}
            handleModifyChildTask={props.handleModifyChildTask}
            parentTask={task}
          />
        )}
      </div>
    </div>
  );
};

export default withTask(TaskRAG);
