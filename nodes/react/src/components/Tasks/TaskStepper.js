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
import { utils } from "../../utils/utils.mjs";

/*
Task Function
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
  const [prevTaskInstanceId, setPrevTaskInstanceId] = useState();
  const [expanded, setExpanded] = useState([]);
  const [modalInfo, setModalInfo] = useState({title: null, description: null});
  const [stepperNavigation, setStepperNavigation] = useState({task: null, direction: null});
  const [lastUpdateCount, setLastUpdateCount] = useState();
  const [isNextButtonDisabled, setIsNextButtonDisabled] = useState(false);
  const [taskNextButtonDisabled, setTaskNextButtonDisabled] = useState(false);
  const [stepDone, setStepDone] = useState();
  const [lastStartInstanceId, setLastStartInstanceId] = useState();


  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  useEffect(() => {
    if (!tasks.length) return;
    if (tasks[tasksIdx].state?.done !== stepDone) {
      setStepDone(tasks[tasksIdx].state.done);
      log("setStepDone");
    }
    if (tasks[tasksIdx].output?.disableNextStep) {
      if (!taskNextButtonDisabled) {
        log("disableNextStep true");
        setIsNextButtonDisabled(true);
        setTaskNextButtonDisabled(true);
      }
    } else if (taskNextButtonDisabled && isNextButtonDisabled) {
      log("disableNextStep false");
      setIsNextButtonDisabled(false);
      setTaskNextButtonDisabled(false);
    }
    //window.stepperTasks = tasks; // For debug
  }, [tasksIdx, tasks]);
      
  // Task state machine
  useEffect(() => {
    // modifyState may have been called by not yet updated test.state.current
    if (!props.checkIfStateReady()) {return}
    let nextState; 
    // Log each transition, other events may cause looping over the same state
    if (props.transition()) { log(`${componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        let startTaskId;
        if (props.task.config?.local?.startTask) {
          startTaskId = props.task.id + "." + props.task.config.local.startTask;
        } else {
          startTaskId = props.task.meta.childrenId[0];
        }
        modifyTask({
          "command": "start",
          "commandArgs": {
            id: startTaskId,
            prevInstanceId: task.instanceId,
          }
        });
        nextState = "waitForStart"
        break;
      case "waitForStart":
        if (startTaskError) {
          nextState = "error";
        } else if (startTask) {
          setTasks([startTask]);
          setPrevTaskInstanceId(startTask.instanceId);
          setKeys([startTask.instanceId + tasksIdx]);
          setExpanded([startTask.instanceId])
          nextState = "navigate";
          modifyTask({
            "shared.stepper.currInstanceId": startTask.instanceId,
            "shared.stepper.currId": startTask.id,
            "shared.stepper.count": 0,
            command: "update",
            commandDescription: "Stepper loaded first task so update currInstanceId, currId, count",
          });
        }
        break;
      case "navigate":
        if (stepperNavigation.task) {
          // This is a way to wait for the update to complete before proceeding
          if (stepperNavigation.direction === "forward") {
            setLastUpdateCount(task.meta.updateCount || 0);
            props.modifyChildTask({"input.exit": true});
            setStepperNavigation({task: null, direction: null})
            modifyTask({
              "shared.stepper.prevInstanceId": tasks[tasksIdx].instanceId,
              "shared.stepper.prevId": tasks[tasksIdx].id,
              "shared.stepper.currInstanceId": null,
              "shared.stepper.currId": null,
              "shared.stepper.count": tasksIdx + 1,
              command: "update",
              commandDescription: "Stepper is moving to next so update prevInstanceId, prevId, currInstanceId, currId, count",
            });
            nextState = "waitForDone"; 
          } else if (stepperNavigation.direction === "back") {
            setTasksIdx(tasks.length - 2);
            // Removing the task from the array
            setTasks((prevVisitedTasks) => prevVisitedTasks.slice(0, -1));
            const newIdx = tasks.length - 2;
            // By changing the key we force the component to re-mount. This is like a reset in some ways
            setKeys(prevKeys => {
              let newKeys = [...prevKeys];
              newKeys[newIdx] += newIdx;
              return newKeys;
            });
            setStepperNavigation({task: null, direction: null})
            let prevInstanceId;
            let prevId;
            if (newIdx !== 0 && tasks[newIdx]) {
              prevInstanceId = tasks[newIdx - 1].instanceId;
              prevId = tasks[newIdx - 1].id;
            } else {
              prevInstanceId = null;
              prevId = null;
            }
            modifyTask({
              "shared.stepper.prevInstanceId": prevInstanceId,
              "shared.stepper.prevId": prevId,
              "shared.stepper.currInstanceId": tasks[newIdx].instanceId,
              "shared.stepper.currId": tasks[newIdx].id,
              "shared.stepper.count": newIdx,
              command: "update",
              commandDescription: "Stepper moving back so update prevInstanceId, prevId, currInstanceId, currId, count",
            });
            nextState = "navigate";
          } 
        } else if (isNextButtonDisabled && !tasks[tasksIdx].output?.disableNextStep) {
          // taskNextButtonDisabled is also controlling isNextButtonDisabled
          // Should probably have a separate state machine for setIsNextButtonDisabled
          setIsNextButtonDisabled(false);
        }
        break;
      case "waitForDone":
        log("waitForDone", stepDone, task.command);
        // In theory there could be conflict with the command start overriding teh previous command update
        // but it will take time for stepDone to be set so by then the update command will have been sent
        if (stepDone && !task.command) {
          // The stepper requests a new Task
          // will set startTask or startTaskError
          modifyTask({
            "command": "start",
            "commandArgs": {
              id: tasks[tasksIdx].config.nextTask,
              prevInstanceId: task.instanceId,
              commandDescription: "Stepper next task",
            },
          });
          nextState = "waitForNext";
        }
        break;
      case "waitForNext":
        if (startTaskError) {
          nextState = "error";
        // Need to check that this is the start task we are expecting as we may have 
        // previously started another task. It would be better to clear this down.
        // But I'm not sure how to automate that
        // Wait for a start task that is not the current task (if we start a task with the same id)
        } else if (startTask && startTask.instanceId !== tasks[tasksIdx].instanceId && startTask.instanceId !== lastStartInstanceId) {
          setLastStartInstanceId(startTask.instanceId);
          log("TaskStepper nextTask", startTask);
          const newIdx = tasks.length
          setTasksIdx(newIdx);
          setTasks((prevVisitedTasks) => [...prevVisitedTasks, startTask]);
          setKeys(p => [...p, startTask.instanceId]);
          nextState = "navigate";
          modifyTask({
            "shared.stepper.currInstanceId": startTask.instanceId,
            "shared.stepper.currId": startTask.id,
            "shared.stepper.count": newIdx,
            command: "update",
            commandDescription: "Stepper loaded new task so update currInstanceId, currId, count",
          });
        }
        break;
      case "error":
        setModalInfo({title: "Error", description: "An error occurred"});
        break;
      default:
        log(`${componentName} State Machine unknown state:`, task.state.current);
    }
    // Manage state.current
    // Maybe this should delay for  0 so all events settle before the transition
    props.modifyState(nextState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, stepDone, startTask, startTaskError, stepperNavigation]);

  // Close previous task and open next task in stepper
  useEffect(() => {
    if (tasks.length > 0) {
      if (tasks[tasksIdx].instanceId !== prevTaskInstanceId) {
        setExpanded((prevExpanded) => [...prevExpanded, tasks[tasksIdx].instanceId]);
        if (prevTaskInstanceId) {
          setExpanded((prevExpanded) =>
            prevExpanded.filter((p) => p !== prevTaskInstanceId)
          );
        }
        setPrevTaskInstanceId(tasks[tasksIdx].instanceId);
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
        {tasks.map(({ instanceId, label }) => (
          <Step key={`task-${instanceId}`}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {/* nextTask is also a local state */}
      {tasks.map(
        ({ label, config: {nextTask: localNextTask}, instanceId }, idx) => (
          <Accordion
            key={instanceId}
            expanded={isExpanded(instanceId)}
            onChange={handleChange(instanceId)}
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
                  handleModifyChildTask={props.handleModifyChildTask}
                />
              )}
            </AccordionDetails>
            <div>
              {tasksIdx !== 0 && !task.config?.local?.disableBackButton &&
                tasks[tasksIdx].instanceId === instanceId && (
                  <Button
                    onClick={() => 
                      setStepperNavigation({task: tasks[tasksIdx], direction: "back"})
                    }
                    variant="contained"
                    color="primary"
                  >
                    Back
                  </Button>
                )
              }
              {!/\.stop$/.test(localNextTask) && !/^stop$/.test(localNextTask) &&
                tasks[tasksIdx].instanceId === instanceId && 
                tasks[tasksIdx]?.output?.loading !== true && (
                  <Button
                    onClick={() => {
                      setStepperNavigation({task: tasks[tasksIdx], direction: "forward"});
                      setIsNextButtonDisabled(true);
                    }}
                    disabled={isNextButtonDisabled}
                    className={isNextButtonDisabled ? "disabledButton" : ""}
                    variant="contained"
                    color="primary"
                  >
                    Next
                  </Button>
                )
              }
            </div>
          </Accordion>
        )
      )}
    </div>
  );
}

export default withTask(TaskStepper);
