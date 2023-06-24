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

import {
  setArrayState,
  deepMerge,
  setNestedProperties,
} from "../../utils/utils";

/*
Task Process
  Present a sequence of tasks in an Accordian component
  We have an array of tasks stored here that are passed to the next component in the stack
  
ToDo:
  Maybe tasksIdx is just a ref?
*/

function TaskStepper(props) {
  const {
    log,
    task,
    modifyTask,
    modifyState,
    transition,
    checkIfStateReady,
    useTasksState,
    stackPtr,
    startTaskFn,
    startTaskError,
    startTask,
    nextTaskError,
    nextTask,
    clearNextTask,
    useTaskState,
    onDidMount,
    modifyChildState,
    componentName,
  } = props;

  const [tasks, setTasks] = useTasksState([]);
  const [keys, setKeys] = useState([]);
  const [tasksIdx, setTasksIdx] = useState(0);
  const [prevTaskName, setPrevTaskName] = useState();
  const [expanded, setExpanded] = useState(["start"]);
  const [stepperTask, setStepperTask] = useTaskState(null, "stepperTask");
  const [modalInfo, setModalInfo] = useState({title: null, description: null});
  const [stepperNavigation, setStepperNavigation] = useState({task: null, direction: null});
  const [stepDone, setStepDone] = useState();

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  // Rather than making the state machine sensitive to tasks we create an event
  useEffect(() => {
    if (tasks.length && tasks[tasksIdx].state?.done !== stepDone) {
      setStepDone(tasks[tasksIdx].state.done);
    }
  }, [tasksIdx, tasks]);
      
  // Task state machine
  useEffect(() => {
    // modifyState may have been called by not yet updated test.state.current
    if (!checkIfStateReady()) {return}
    let nextState; 
    // Log each transition, other events may cause looping over a state
    if (transition()) { log(`${componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        startTaskFn(task.id, task.familyId, stackPtr + 1); // will set startTask or startTaskError
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
            modifyChildState("exit");
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
          // There are two commands happening here:
          // 1. The chid task is requesting the next task
          // 2. The stepper is receiving the next task
          const newTask = deepMerge(tasks[tasksIdx], setNestedProperties({ 
            "state.done": false, 
            "command": "next"
          }));
          setTasksTask((p) => {
            return newTask;
          }, tasksIdx);
          setKeys(p => [...p, newTask.instanceId + tasksIdx]);
          nextState = "receiveNext";
        }
        break;
      case "receiveNext":  
        // Need to set stackPtr so we know which component level requested the next task (may not be the same as the task's stackPtr)
        modifyTask({
          "command": "receiveNext",
          "commandArgs": {
            stackPtr: stackPtr, 
            instanceId: tasks[tasksIdx].instanceId
          }
        })
        nextState = "waitForNext";
        break;
      case "waitForNext":
        if (nextTaskError) {
          nextState = "error";
        } else if (nextTask) {
          console.log("TaskStepper nextTask", nextTask);
          setTasksIdx(tasks.length);
          setTasks((prevVisitedTasks) => [...prevVisitedTasks, nextTask]);
          // Could have a getNextTask that could look after clearing it when it returns
          clearNextTask(); // So we only use it once.
          nextState = "navigate";
        }
        break;
      case "error":
        setModalInfo({title: "Error", description: "An error occurred"});
      default:
        console.log(`${componentName} State Machine ERROR unknown state : `, task.state.current);
    }
    // Manage state.current and state.last
    modifyState(nextState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, startTask, startTaskError, stepperNavigation, nextTask, nextTaskError, stepDone]);

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
    setArrayState(setTasks, idx, t);
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
        ({ name, label, stack, stackTaskId, nextTask: metaNextTask, instanceId }, idx) => (
          <Accordion
            key={name}
            expanded={isExpanded(name)}
            onChange={handleChange(name)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{label}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {stack && (
                <DynamicComponent
                  key={keys[idx]}
                  is={stack[stackPtr]}
                  task={tasks[idx]}
                  setTask={(t) => setTasksTask(t, idx)} // Pass idx as an argument
                  parentTask={stepperTask}
                  stackPtr={stackPtr}
                  stackTaskId={stackTaskId}
                  handleChildmodifyState={props.handleChildmodifyState}
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
