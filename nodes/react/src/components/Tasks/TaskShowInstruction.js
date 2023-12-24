/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useRef } from "react";
import { Typography } from "@mui/material";
import Paper from "@mui/material/Paper";
import withTask from "../../hoc/withTask";
import { utils } from "../../utils/utils.mjs";
import { xutils } from "../../shared/FSM/xutils";
import Fsm from "../Fsm";
import Loading from "../Loading";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";

/* 
To use the XState FSM
  import Fsm from "../Fsm";
  const { fsmSend, fsmState } = props.useShareFsm();
  define actions/guards
  generate events
  <Fsm {...props} actions={actions} guards={guards} />
*/

/*
Task Function
  This component is complete overkill for what it is doing but it is useful during dev
  Fetches a instruction from the RxJS Processor Consumer that is hard coded in the task
  
ToDo:
  There is a problem when streaming a result that this can generate lots of NEW_INSTRUCTION events
  Maybe add a state for when an instruction is being streamed
  
*/

const TaskShowInstruction = (props) => {
  const {
    log,
    task,
    modifyTask,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [instructionText, setInstructionText] = useState("");
  const { fsmSend, fsmState } = props.useShareFsm();
  const [loading, setLoading] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [finalResponseText, setFinalResponseText] = useState();
  const responseTextRef = useRef("");
  const [socketResponses, setSocketResponses] = useState([]);

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
              if (finalResponseText) {
                setFinalResponseText(null);
              }
              break;
            case 'partial':
            case 'final':
              responseTextRef.current = text;
              setResponseText(text);
              setFinalResponseText(text);
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

  useEffect(() => {
    setInstructionText(responseText);
  }, [responseText]);

  useEffect(() => {
    // Needed to separate this out as getting warning about depth of updates in React
    modifyTask({
      "output.instruction": finalResponseText,
    });
  }, [finalResponseText]);

  // The general wisdom is not to have side-effects in actions when working with React
  // But a point of actions is to allow for side-effects!
  // Actions receive arguments (context, event) which we could choose to use here
  const actions = xutils.logActions({
    react_displayInstruction: () => {
      if (task.output.instruction) {
        setInstructionText(task.output.instruction);
      } else if (task.response.text) { // For showing errors
        setInstructionText(task.response.text);
        modifyTask({
          "output.instruction": task.response.text,
        });
      }
    },
    react_start_loading: () => {
      setLoading(true);
      modifyTask({ "output.loading": true });
    },
    react_stop_loading: () => {
      setLoading(false);
      modifyTask({ "output.loading": false });
    },
    // We set "start" state so the FSM will start from there if remounted
    react_finish: () => modifyTask({ "state.done": true, "state.current": "start" }),
  });
  
  // Guards receive arguments (context, event) which we could choose to use here
  const guards = xutils.logGuards({
    react_instructionCached: () => task.output.instruction ? true : false,
    react_newInstruction: () => instructionText !== task.output.instruction ? true : false,
  });

  /*
  The events are provided by the Task Function and the FSM can "assemble" a behavior with these events
  fsmState has other useful properties that you may want to use, such as:
    context: An object that holds the extended state (or "context") of the machine.
    changed: A boolean that represents whether the state changed in the last transition.
    event: The event that caused the transition.
    actions: An array of actions that should be executed for the current transition.
  The delay is neccessary for React side-effects to take effect
  */
  useEffect(() => {
    if (!fsmState) {return}
      // events not related to a particular state
      if (task.input.exit && fsmState.value !== 'finish') {
        log("Task Exit", task.input.exit);
        fsmSend('GOTOfinish');
      }
      // events associated with particular states
      switch (fsmState.value) {
        case 'start':
          break;
        case 'displayInstruction':
          if (instructionText !== task.output.instruction) {
            console.log(`NEW_INSTRUCTION because ${instructionText} !== ${task.output.instruction}`);
            fsmSend("NEW_INSTRUCTION");
          }
          break;
        case 'filled':
          break;
        case 'finish':
          break;
        case 'init':
          break;
        default:
          console.log("FSM WARNING unknown state : " + fsmState.value);
      }
  }, [fsmState, task]);

  // Each time this component is mounted reset the task state
  useEffect(() => {
    console.log("Setting task state to start");
    task.state.current = "start";
    task.state.done = false;
  }, []);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Paper
          elevation={3}
          style={{
            overflow: "auto",
            textAlign: "justify",
            padding: "16px",
            //width: "100vw",
          }}
        >
          {instructionText && instructionText.split("\\n").map((line, index) => (
            <Typography 
              style={{ marginTop: "16px" }} 
              key={index}
              className="text2html"
              dangerouslySetInnerHTML={{ __html: utils.replaceNewlinesWithParagraphs(line) }}
            />
          ))}
          {loading && (
            <Loading containerStyle={{height: null}} message={task.config.local.loadingMessage}/>
          )}
        </Paper>
      </div>
      <Fsm {...props} actions={actions} guards={guards} />
    </>
  );
};

export default withTask(TaskShowInstruction);
