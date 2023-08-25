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
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [instructionText, setInstructionText] = useState("");

  // Add logging to actions and guards
  function addLogging(functions, descriptor) {
    const loggedFunctions = {};
    for (const [key, value] of Object.entries(functions)) {
      loggedFunctions[key] = function(context, event) {
        const result = value(context, event);
        let msg = [];
        if (descriptor === 'action') {
          msg = [`${key} ${descriptor}`];     
        } else {
          msg = [`${key} ${descriptor}`, value(context, event)];
        }
        console.log("FSM ", ...msg);
        return result;
      };
    }
    return loggedFunctions;
  }
  const logActions = actions => addLogging(actions, 'action');
  const logGuards = guards => addLogging(guards, 'guard');

  // The general wisdom is not to have side-effects in actions when working with React
  // But a point of actions is to allow for side-effects!
  // Actions receive arguemnts (context, event) which we could choose to use here
  const actions = logActions({
    displayInstruction: () => task.output.instruction ? setInstructionText(task.output.instruction) : undefined,
    finish: () => modifyTask({ "state.done": true }),
  });

  // Guards receive arguemnts (context, event) which we could choose to use here
  const guards = logGuards({
    instructionCached: () => task.output.instruction ? true : false,
    newInstruction: () => instructionText !== task.output.instruction ? true : false,
  });

  // We can't move useMachine into HoC because we need to wait for props.fsm and we create that delay with the HoC at the moment
  const [fsmState, fsmSend, fsmService] = useMachine(props.fsm, {
    context: {},
    actions,
    guards,
    devTools: task.config?.fsm?.devTools ? true : false,
  });

  // Synchronise XState FSM with task.state
  useEffect(() => {
    modifyTask({ "state.current": fsmState.value });
  }, [fsmState]);

  // Synchronise task.state with FSM
  useEffect(() => {
    if (task.state.current && task.state.current !== fsmState.value) {
      fsmSend(task.state.current);
    }
  }, [task.state.current]);

  /*
  Generate events based on state - declare after the FSM so we have access to fsmState and fsmEvent
  The delay is neccessary for React side-effects to take effect
  The events are provided by the Task Function and the FSM can "assmeble" a behavior with these events
  fsmState has other useful properties that you may want to use, such as:
    context: An object that holds the extended state (or "context") of the machine.
    changed: A boolean that represents whether the state changed in the last transition.
    event: The event that caused the transition.
    actions: An array of actions that should be executed for the current transition.
  */
  useEffect(() => {
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

  // Don't want to specify actions in a service - would make it impossible to reconfigure
  useEffect(() => {
    const subscription = fsmService.subscribe((state) => {
      log(`${props.componentName} FSM State ${state.value} Event ${state.event.type}`, state.event, state); // For debug messages
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [fsmService]); // note: service should never change

  // The mental model is an event triggers a transition, so we need to create events
  // But how to limit event firing to a particular state

  // Each time this component is mounted reset the task state
  useEffect(() => {
    // This can write over the update
    task.state.current = "start";
    task.state.done = false;
  }, []);

  /*
  // Task state machine
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
