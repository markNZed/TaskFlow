/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import { useMachine } from '@xstate/react';
import { Typography } from "@mui/material";
import Paper from "@mui/material/Paper";
import withTask from "../../hoc/withTask";
import { utils } from "../../utils/utils";

/*
Task Process
  This component is complete overkill for what it is doing but it is useful during dev
  Fetches a instruction from the NodeJS Task Processor that is hard coded in the task
  
ToDo:
  
*/

const TaskShowInstruction = (props) => {
  const {
    log,
    task,
    modifyTask,
    fsmMachine,
    addLogging,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [instructionText, setInstructionText] = useState("");

  // The general wisdom is not to have side-effects in actions when working with React
  // But a point of actions is to allow for side-effects!
  // Actions receive arguemnts (context, event) which we could choose to use here
  const actions = addLogging({
    displayInstruction: () => task.output.instruction ? setInstructionText(task.output.instruction) : undefined,
    finish: () => modifyTask({ "state.done": true }),
  });
  // Guards receive arguemnts (context, event) which we could choose to use here
  const guards = addLogging({
    instructionCached: () => task.output.instruction ? true : false,
    newInstruction: () => instructionText !== task.output.instruction ? true : false,
  });

  // We can't move useMachine into HoC because we need to wait for props.fsm and we create that delay with the HoC at the moment
  const [fsmState, fsmSend, fsmService] = useMachine(fsmMachine, {
    actions,
    guards,
    devTools: task.config?.fsm?.devTools ? true : false,
  });

  // Synchronise XState FSM with task.state
  useEffect(() => {
    if (fsmState && fsmState.value !== props.task?.state?.current) {
      modifyTask({ "state.current": fsmState.value });
    }
  }, [fsmState]);

  // Synchronise task.state with FSM
  useEffect(() => {
    if (task?.state?.current && fsmState && task.state.current !== fsmState.value) {
      fsmSend(task.state.current);
    }
  }, [task?.state?.current]);

  /*
  The events are provided by the Task Function and the FSM can "assmeble" a behavior with these events
  fsmState has other useful properties that you may want to use, such as:
    context: An object that holds the extended state (or "context") of the machine.
    changed: A boolean that represents whether the state changed in the last transition.
    event: The event that caused the transition.
    actions: An array of actions that should be executed for the current transition.
  The delay is neccessary for React side-effects to take effect
  */
  useEffect(() => {
    if (!fsmState) {return}
    setTimeout(() => {
      // events not related to a particular state
      if (task.input.exit && fsmState.value !== 'finish') {
        fsmSend('finish');
      }
      // events associated with particular states
      switch (fsmState.value) {
        case 'start':
          break;
        case 'displayInstruction':
          if (instructionText !== task.output.instruction) {
            fsmSend("NEW_INSTRUCTION");
          }
          break;
        case 'finish':
          break;
        default:
          console.log("FSM ERROR unknown state : " + fsmState.value);
      }
    }, 0);
  }, [fsmState, task]);

  // Each time this component is mounted reset the task state
  useEffect(() => {
    // This can write over the update
    task.state.current = "start";
    task.state.done = false;
  }, []);

  /*
  // Original task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        if (task.output.instruction) {
          log("Instruction cached React Task Processor side");
          nextState = "response";
        }
        break;
      case "response":
        if (instructionText !== task.output.instruction) {
          setInstructionText(task.output.instruction);
        }
        break;
      case "exit":
        if (transition()) {
          modifyTask({ "state.done": true });
        }
        break
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);
  */

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
        {instructionText && instructionText.split("\\n").map((line, index) => (
          <Typography 
            style={{ marginTop: "16px" }} 
            key={index}
            className="text2html"
            dangerouslySetInnerHTML={{ __html: utils.replaceNewlinesWithParagraphs(line) }}
          />
        ))}
      </Paper>
    </div>
  );
};

export default withTask(TaskShowInstruction);
