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
import withTask from '../../hoc/withTask';
import { setArrayState, deepMerge, setNestedProperties } from '../../utils/utils';

/*
Task Process
  Present a sequence of tasks in an Accordian component
  We have an array of tasks stored here that are passed to the next component in the stack
  
ToDo:
  useTasksState to help debug
  Maybe tasksIdx is just a ref?
*/

function TaskStepper(props) {

  const {
    log,
    task, 
    setTask, 
    useTasksState,
    component_depth,
    startTaskLoading,
    startTaskError,
    startTask,
    nextTaskLoading,
    nextTaskError,
    nextTask,
    setDoneTask,
    startTaskFn,
    useTaskState,
  } = props

  const [tasks, setTasks] = useTasksState([]);
  const [tasksIdx, setTasksIdx] = useState(0);
  const [leaving, setLeaving] = useState();
  const [prevTaskName, setPrevTaskName] = useState();
  const [expanded, setExpanded] = useState(['start']);
  const [stepperTask, setStepperTask] = useTaskState(null, 'stepperTask');

  // We are not using stepperTask but potentially it is the task that
  // manages a meta-level related to the stepper (not the actual steps/tasks in the stepper)
  useEffect(() => {
    //startTaskFn(task.meta.id, null, component_depth)
  }, []);

  useEffect(() => {
    if (startTask) {
      setStepperTask(startTask)
    }
  }, [startTask]);

  // The first step is the task that was passed in
  useEffect(() => {
      setTasks([task])
      setPrevTaskName(task.meta.name)
  }, []);

  // When task is done then fetch next task
  useEffect(() => {
    if (tasks.length && tasks[tasksIdx].state?.done) {
      // need a wrapper for this
      setTasksTask(p => { return deepMerge(p, setNestedProperties({'state.done': false}))})
      setDoneTask(tasks[tasksIdx])
    }
  }, [tasks]);

  // Detect when new task has been fetched
  useEffect(() => {
    if (nextTask) {
      setTasksIdx(tasks.length)
      setTasks((prevVisitedTasks) => [...prevVisitedTasks, nextTask ])
    }
  }, [nextTask]);

  // Instead of leaving we could have a task.exit ?
  function handleStepperNavigation(currentTask, action) {
    const currentTaskData = tasks[tasksIdx]
    if (action === 'next') {
      if (currentTaskData && currentTaskData.next) {
        // Give control to the active Task which will call taskDone to transition to next state
        setLeaving({direction: 'next', task: currentTask});
        // Expect taskDone to be called from Task, rename leaving to taskLeave
      }
    } else if (action === 'back') {
      if (currentTaskData) { 
        // By updating leaving this ensure there is an event if next is activated
        setLeaving({direction: 'prev', task: currentTask});
        setTasksIdx(tasks.length - 2)
        setTasks((prevVisitedTasks) => prevVisitedTasks.slice(0, -1));
      }
    }
  }
 
  // Close previous task and open next task in stepper
  useEffect(() => {
    if (tasks.length > 0) {
      if (tasks[tasksIdx].meta.name !== prevTaskName) {
        setExpanded((prevExpanded) => [...prevExpanded, tasks[tasksIdx].meta.name]);
        if (prevTaskName) {
          setExpanded((prevExpanded) => prevExpanded.filter((p) => p !== prevTaskName));
        }
        setPrevTaskName(tasks[tasksIdx].meta.name)
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

  function setTasksTask(t) {
    setArrayState(setTasks, tasksIdx, t)
  }

  return (
    <div>
      <Stepper activeStep={tasksIdx}>
        {tasks.map(({ meta: { name, label } } ) => (
          <Step key={`task-${name}`}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      { tasks.map(({ meta: { name, label, stack, nextTask: metaNextTask, instanceId } }, idx) => (
          <Accordion key={name} expanded={isExpanded(name)} onChange={handleChange(name)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{label}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              { stack && (
                <DynamicComponent key={instanceId} is={stack[component_depth]} task={tasks[idx]} setTask={setTasksTask} leaving={leaving} parentTask={stepperTask}  component_depth={component_depth} />
              )}
            </AccordionDetails>
            <div>
              {tasks[tasksIdx].meta.name !== 'start' && tasks[tasksIdx].meta.name === name && (
                <Button onClick={() => handleStepperNavigation(tasks[tasksIdx], 'back')} variant="contained" color="primary">
                  Back
                </Button>
              )}
              {!/\.stop$/.test(metaNextTask) && tasks[tasksIdx].meta.name === name && (
                <Button onClick={() => handleStepperNavigation(tasks[tasksIdx], 'next')} variant="contained" color="primary">
                  Next
                </Button>
              )}
            </div>
          </Accordion>
        ))
      }
    </div>
  );
}

export default withTask(TaskStepper);
