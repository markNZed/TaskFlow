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
import { xutils } from "../../shared/fsm/xutils";

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
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [instructionText, setInstructionText] = useState("");
  const { setFsmState, setFsmSend, setFsmService } = props.useShareFsm();

  // The general wisdom is not to have side-effects in actions when working with React
  // But a point of actions is to allow for side-effects!
  // Actions receive arguments (context, event) which we could choose to use here
  const actions = xutils.logActions({
    displayInstruction: () => task.output.instruction ? setInstructionText(task.output.instruction) : undefined,
    finish: () => modifyTask({ "state.done": true }),
  });
  // Guards receive arguments (context, event) which we could choose to use here
  const guards = xutils.logGuards({
    instructionCached: () => task.output.instruction ? true : false,
    newInstruction: () => instructionText !== task.output.instruction ? true : false,
  });

  // We don't move useMachine into HoC because we want to wait on the creation of fsmMachine
  const [fsmState, fsmSend, fsmService] = useMachine(props.fsmMachine, { actions, guards, devTools: props.devTools });
  // Provide fsmState, fsmSend, fsmService to the HoC through useShareFsm context
  props.useSynchronizeVariable(setFsmState, fsmState);
  props.useSynchronizeFunction(setFsmSend, fsmSend);
  props.useSynchronizeVariable(setFsmService, fsmService);

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
