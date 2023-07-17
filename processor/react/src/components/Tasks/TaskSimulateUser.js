/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useRef, useState, useEffect } from "react";
import withTask from "../../hoc/withTask";
import { parseRegexString } from "../../utils/utils";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";
import DynamicComponent from "../Generic/DynamicComponent";

/*
Task Process
  Intercept TaskChat and simulate the user prompt.
  Don;t use the output variables that TaskChat uses
ToDo:
  
*/

const TaskSimulateUser = (props) => {
  const {
    task,
    setTask,
    modifyTask,
    childTask,
    modifyChildTask,
    onDidMount,
    transition,
    transitionTo,
    log,
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
        //console.log("prevResponses.length", prevResponses.length);
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

  // TaskConversation is the parent and it expects the child to be TaskChat
  // We should explicitly pass the current task up to allow for insertion.
  // Or is this notion of one task instantiating another only in React so we should not assume it?

  // So TaskConversation sees what it is expecting and TaskSimulateUser acts as a pass-through
  useEffect(() => {
    if (task && childTask?.output) {
      // Convert to string to compare deep data structure
      if (JSON.stringify(childTask.output.msgs) !== JSON.stringify(task.output.msgs)) {
        modifyTask({"output.msgs": childTask.output.msgs});
      }
      if (childTask.output.promptResponse !== task.output.promptResponse) {
        modifyTask({"output.promptResponse": childTask.output.promptResponse});
      }
      if (childTask.output.sending !== task.output.sending) {
        modifyTask({"output.sending": childTask.output.sending});
      }
    }
  }, [childTask?.output]);

  // So TaskConversation sees what it is expecting and TaskSimulateUser acts as a pass-through
  useEffect(() => {
    if (task && childTask?.input) {
      if (childTask.input.promptText !== task.input.promptText) {
        modifyTask({"input.promptText": childTask.input.promptText});
      }
    }
  }, [childTask?.input]);

  // So TaskChat sees what it is expecting and TaskSimulateUser acts as a pass-through
  useEffect(() => {
    if (task?.input && childTask) {
      // Convert to string to compare deep data structure
      if (JSON.stringify(task.input?.msgs) !== JSON.stringify(childTask.input?.msgs)) {
        modifyChildTask({"input.msgs": task.input.msgs});
      }
    }
  }, [task?.input]);

  useEffect(() => {
    if (responseText && responseText !== childTask.input.promptText) {
      let updatedResponseText = responseText;
      const regexProcessResponse = task.config.regexProcessResponse;
      if (regexProcessResponse) {
        for (const [regexStr, replacement] of regexProcessResponse) {
          let { pattern, flags } = parseRegexString(regexStr);
          const regex = new RegExp(pattern, flags);
          updatedResponseText = updatedResponseText.replace(regex, replacement);
        }
      }
      modifyChildTask({
        "input.promptText": updatedResponseText,
      });
    }
  }, [responseText]);


  // Task state machine
  // Need to be careful setting task in the state machine so it does not loop
  // Could add a check for this
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log("TaskSimulateUser State Machine State " + task.state.current,task) }
    switch (task.state.current) {
      case "start":
        // Get introduction
        if (childTask?.state?.current === "input") {
          nextState = "introduction";
        }
        break;
      case "introduction":
        if (transition()) {
          // Sync state with nodejs processor
          modifyTask({ 
            "command": "update",
          });
        }
        break;
      case "input":
        if (transition()) {
          // Break here rather than generating error due to maxRequestCount
          if (task.config.maxRequestCount && task.meta.requestCount >= task.config.maxRequestCount) {
            alert("Simulated user exceeded the maximum number of requests");
          } else {
            nextState = "send";
            responseTextRef.current = "";
            setResponseText(responseTextRef.current);
          }
        }
        break;
      case "send":
        if (transitionTo("send")) {
          modifyTask({ 
            "command": "update",
          });
        }
        break;
      case "receiving":
        break;
      case "received":
        setResponseText(task.output.simulationResponse.text);
        nextState = "submit";
        break;
      case "submit":
        if (transition()) {
          modifyChildTask({
            "input.submitPrompt": true,
          });
        }
        if (childTask?.state?.current === "received") {
          nextState = "input";
        }
        break;
    }
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, responseText, childTask]);

  return (
      <div>
        {childTask && (
          <DynamicComponent
            key={childTask.id}
            is={childTask.type}
            task={childTask}
            setTask={props.setChildTask}
            parentTask={task}
            handleModifyChildTask={props.handleModifyChildTask}
          />
        )}
      </div>
  );
};

export default withTask(TaskSimulateUser);
