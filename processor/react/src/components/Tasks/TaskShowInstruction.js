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
  This component is complete overkill for what it is doing but it was useful during early dev
  Fetches a instruction from the NodeJS Task Processor that is hard coded in the task
  
ToDo:
  
*/

const TaskShowInstruction = (props) => {
  const {
    log,
    task,
    modifyTask,
    transition,
    onDidMount,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  const [instructionText, setInstructionText] = useState("");

  const actions = {
    setInstruction: (context, event) => {
      console.log("FSM setInstruction action");
      setInstructionText(task.output.instruction);
    },
    exitAction: (context, event) => {
      console.log("FSM exit action");
      // Will this modify the current task because it does not use the ref?
      modifyTask({ "state.done": true });
    },
  };

  const guards = {
    instructionCached: (context, event) => {
      const result = task.output.instruction ? true : false;
      console.log("FSM instructionCached gaurd", result);
      return result;
    },
    newText: (context, event) => {
      const result = instructionText !== task.output.instruction ? true : false;
      console.log("FSM newText gaurd", result, task.output.instruction, task);
      return result;
    },
  };

  // Generate events for FSM
  useEffect(() => {
    if (instructionText !== task.output.instruction) {
      console.log("FSM Sending SET_INSTRUCTION");
      fsmSend("SET_INSTRUCTION");
    }
  }, [instructionText, task.output.instruction]); 

  useEffect(() => {
    if (task.input.exit) {
      console.log("FSM Sending EXIT");
      fsmSend("EXIT");
    }
  }, [instructionText, task.input.exit]); 

  useEffect(() => {
    if (transition()) {
      console.log("FSM Sending new STATE_" + task.state.current.toUpperCase());
      fsmSend({type: "STATE_" + task.state.current.toUpperCase()});
    }
  }, [task.state.current]); 

  // The mental model is an event triggers a transition, so we need to create events
  // But how to limit event firing to a particular state

  // No Side Effects in Actions: Ensure your actions in the machine don't directly modify React state or perform other side effects. Instead, use the machine's context for any data and use event listeners (like onTransition) to update any necessary React state.

  const [fsmState, fsmSend, fsmService] = useMachine(props.fsm, {
    context: { taskRef: props.taskRef },
    actions,
    guards,
    devTools: task.config?.fsm?.devTools ? true : false,
  });

  // For debug messages
  useEffect(() => {
    const subscription = fsmService.subscribe((state) => {
      // simple state logging
      log(`${props.componentName} FSM State ${state.value} Event ${state.event.type}`, state.event)
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [fsmService]); // note: service should never change

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
    if (transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        //if (task.output.instruction) {
        //  log("Instruction cached React Task Processor side");
        //  nextState = "response";
        //}
        break;
      case "response":
        //if (instructionText !== task.output.instruction) {
        //  setInstructionText(task.output.instruction);
        //}
        break;
      case "exit":
        //if (transition()) {
        //  modifyTask({ "state.done": true });
        //}
        break
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

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
