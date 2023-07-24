/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useState, useEffect, useRef } from "react";
import { Stepper, Step, StepLabel, Typography, Button } from "@mui/material";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ModalComponent from '../Generic/ModalComponent';
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DynamicComponent from "./../Generic/DynamicComponent";
import withTask from "../../hoc/withTask";
import { utils } from "../../utils/utils";

/*
Task Process
  Present a sequence of tasks in an Accordian component
  
ToDo:
  Maybe tasksIdx is just a ref?
*/

function TaskStepper(props) {
  // props that are use a lot are given local names
  const {
    log,
    task,
    modifyTask,
    stackPtr,
    startTaskError,
    startTask,
    componentName,
  } = props;

  const [tasks, setTasks] = props.useTasksState([]);
  const [keys, setKeys] = useState([]);
  const [tasksIdx, setTasksIdx] = useState(0);
  const [prevTaskName, setPrevTaskName] = useState();
  const [expanded, setExpanded] = useState(["start"]);
  const [modalInfo, setModalInfo] = useState({title: null, description: null});
  const [stepperNavigation, setStepperNavigation] = useState({task: null, direction: null});
  const [stepDone, setStepDone] = useState();

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  // Rather than making the state machine sensitive to tasks we create an event
  useEffect(() => {
    if (tasks.length && tasks[tasksIdx].state?.done !== stepDone) {
      setStepDone(tasks[tasksIdx].state.done);
    }
  }, [tasksIdx, tasks]);
      
  // Task state machine
  useEffect(() => {
    // modifyState may have been called by not yet updated test.state.current
    if (!props.checkIfStateReady()) {return}
    let nextState; 
    // Log each transition, other events may cause looping over a state
    if (props.transition()) { log(`${componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        const startTaskId = props.task.meta.childrenId[0];
        modifyTask({
          "command": "start",
          "commandArgs": {
            id: startTaskId,
          }
        });
        nextState = "waitForStart"
        break;
      case "waitForStart":
        if (startTaskError) {
          nextState = "error";
        } else if (startTask) {
          setTasks([startTask]);
          setPrevTaskName(startTask.name);
          setKeys([startTask.instanceId + tasksIdx]);
          nextState = "navigate";
        }
        break;
      case "navigate":
        if (stepperNavigation.task) {
          if (stepperNavigation.direction === "forward") {
            props.modifyChildState("exit");
            setStepperNavigation({task: null, direction: null})
            nextState = "waitForDone";
          } else if (stepperNavigation.direction === "back") {
            setTasksIdx(tasks.length - 2);
            setTasks((prevVisitedTasks) => prevVisitedTasks.slice(0, -1));
            const newIdx = tasks.length - 2;
            // By changing the key we force the component to re-mount. This is like a reset in some ways
            setKeys(prevKeys => {
              let newKeys = [...prevKeys];
                newKeys[newIdx] += newIdx;
              return newKeys;
            });
            setStepperNavigation({task: null, direction: null})
            nextState = "navigate";
          }
        }                 
        break;
      case "waitForDone":
        if (stepDone) {
          // The stepper requests a new Task
          // will set startTask or startTaskError
          modifyTask({
            "command": "start",
            "commandArgs": {
              id: tasks[tasksIdx].config.nextTask,
            }
          });
          const modifiedTask = utils.deepMerge(tasks[tasksIdx], utils.setNestedProperties({ 
            "state.done": false, 
          }));
          setTasksTask((p) => {
            return modifiedTask;
          }, tasksIdx);
          setKeys(p => [...p, modifiedTask.instanceId + tasksIdx]);
          nextState = "waitForNext";
        }
        break;
      case "waitForNext":
        if (startTaskError) {
          nextState = "error";
        // Need to check that this is the start task we are expecting as we may have 
        // previously started another task. It would be better to clear this down.
        // But I'm not sure how to automate that
        } else if (startTask.id !== tasks[tasksIdx].id) {
          console.log("TaskStepper nextTask", startTask);
          setTasksIdx(tasks.length);
          setTasks((prevVisitedTasks) => [...prevVisitedTasks, startTask]);
          nextState = "navigate";
        }
        break;
      case "error":
        setModalInfo({title: "Error", description: "An error occurred"});
      default:
        console.log(`${componentName} State Machine ERROR unknown state : `, task.state.current);
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, startTask, startTaskError, stepperNavigation, stepDone]);

  // Close previous task and open next task in stepper
  useEffect(() => {
    if (tasks.length > 0) {
      if (tasks[tasksIdx].name !== prevTaskName) {
        setExpanded((prevExpanded) => [...prevExpanded, tasks[tasksIdx].name]);
        if (prevTaskName) {
          setExpanded((prevExpanded) =>
            prevExpanded.filter((p) => p !== prevTaskName)
          );
        }
        setPrevTaskName(tasks[tasksIdx].name);
      }
    }
  }, [tasksIdx]);

  // Jump to previously completed steps
  const handleChange = (panel) => (event, newExpanded) => {
    if (newExpanded) {
      setExpanded((prevExpanded) => [...prevExpanded, panel]);
    } else {
      setExpanded((prevExpanded) => prevExpanded.filter((p) => p !== panel));
    }
  };

  const isExpanded = (panel) => expanded.includes(panel);

  function setTasksTask(t, idx) {
    utils.setArrayState(setTasks, idx, t);
  }

  return (
    
    <div>
      <ModalComponent
        modalInfo={modalInfo}
      />
      <Stepper activeStep={tasksIdx}>
        {tasks.map(({ name, label }) => (
          <Step key={`task-${name}`}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {/* nextTask is also a local state */}
      {tasks.map(
        ({ name, label, config: {nextTask: metaNextTask}, instanceId }, idx) => (
          <Accordion
            key={name}
            expanded={isExpanded(name)}
            onChange={handleChange(name)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{label}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(
                <DynamicComponent
                  key={keys[idx]}
                  is={tasks[idx].type}
                  task={tasks[idx]}
                  setTask={(t) => setTasksTask(t, idx)} // Pass idx as an argument
                  parentTask={task}
                  handleModifyChildState={props.handleModifyChildState}
                />
              )}
            </AccordionDetails>
            <div>
              {tasks[tasksIdx].name !== "start" &&
                tasks[tasksIdx].name === name && (
                  <Button
                    onClick={() => 
                      setStepperNavigation({task: tasks[tasksIdx], direction: "back"})
                    }
                    variant="contained"
                    color="primary"
                  >
                    Back
                  </Button>
                )}
              {!/\.stop$/.test(metaNextTask) &&
                tasks[tasksIdx].name === name && (
                  <Button
                    onClick={() =>
                      setStepperNavigation({task: tasks[tasksIdx], direction: "forward"})
                    }
                    variant="contained"
                    color="primary"
                  >
                    Next
                  </Button>
                )}
            </div>
          </Accordion>
        )
      )}
    </div>
  );
}

export default withTask(TaskStepper);
