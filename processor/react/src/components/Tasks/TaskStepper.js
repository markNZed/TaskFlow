/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useState, useEffect } from "react";
import { Stepper, Step, StepLabel, Typography, Button } from "@mui/material";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
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
    useTasksState,
    stackPtr,
    startTaskError,
    startTask,
    nextTaskError,
    nextTask,
    startTaskFn,
    useTaskState,
    onDidMount,
  } = props;

  const [tasks, setTasks] = useTasksState([]);
  const [keys, setKeys] = useState([]);
  const [tasksIdx, setTasksIdx] = useState(0);
  const [prevTaskName, setPrevTaskName] = useState();
  const [expanded, setExpanded] = useState(["start"]);
  const [stepperTask, setStepperTask] = useTaskState(null, "stepperTask");

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  useEffect(() => {
    startTaskFn(task.id, task.familyId, stackPtr + 1); // will set startTask or startTaskError
  }, []);

  useEffect(() => {
    if (startTask) {
      setTasks([startTask]);
      setPrevTaskName(startTask.name);
      setKeys([startTask.instanceId + tasksIdx]);
    }
  }, [startTask]);

  // When task is done fetch next task
  useEffect(() => {
    if (tasks.length && tasks[tasksIdx].state?.done) {
      // There are two commands happening here:
      // 1. The chid task is requesting the next task
      // 2. The stepper is receiving the next task
      const newTask = deepMerge(tasks[tasksIdx], setNestedProperties({ 
        "state.done": false, 
        "processor.command": "next"
      }));
      setTasksTask((p) => {
        return newTask;
      }, tasksIdx);
      // Need to set stackPtr so we know which component level requested the next task (may not be the same as the task's stackPtr)
      modifyTask({
        "processor.command": "receiveNext",
        "processor.commandArgs": {
          stackPtr: stackPtr, 
          instanceId: tasks[tasksIdx].instanceId
        }
      });
      setKeys(p => [...p, newTask.instanceId + tasksIdx]);
    }
  }, [tasks]);

  // Detect when next task has been fetched
  useEffect(() => {
    console.log("TaskStepper nextTask", nextTask);
    if (nextTask) {
      setTasksIdx(tasks.length);
      setTasks((prevVisitedTasks) => [...prevVisitedTasks, nextTask]);
    }
  }, [nextTask]);

  function handleStepperNavigation(currentTask, action) {
    const currentTaskData = tasks[tasksIdx];
    if (action === "next") {
      if (currentTaskData && currentTaskData.nextTask) {
        // Give control to the active Task which will call taskDone to transition to next state
        setTasksTask((p) => {
          return { ...p, command: "exit"}
        }, tasksIdx);
        // Expect task.state.done to be set in Task
      }
    } else if (action === "back") {
      if (currentTaskData) {
        // By updating leaving this ensure there is an event if next is activated
        setTasksIdx(tasks.length - 2);
        setTasks((prevVisitedTasks) => prevVisitedTasks.slice(0, -1));
        const newIdx = tasks.length - 2;
        // By changing the key we force the component to re-mount
        // This is like a reset in some ways
        setKeys(prevKeys => {
          let newKeys = [...prevKeys];
           newKeys[newIdx] += newIdx;
          return newKeys;
        });
      }
    }
  }

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
                />
              )}
            </AccordionDetails>
            <div>
              {tasks[tasksIdx].name !== "start" &&
                tasks[tasksIdx].name === name && (
                  <Button
                    onClick={() =>
                      handleStepperNavigation(tasks[tasksIdx], "back")
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
                      handleStepperNavigation(tasks[tasksIdx], "next")
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
