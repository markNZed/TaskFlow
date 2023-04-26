/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useState, useEffect } from "react";
import { Stepper, Step, StepLabel, Typography, Button } from "@mui/material";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import useFetchTask from '../../hooks/useFetchTask';
import DynamicComponent from "./../Generic/DynamicComponent";
import { delta, withDebug, withTask } from '../../utils';

// Typically this Task gets created at the start of a taskflow
// The task is the task that caused the creation of this task
// Here we start a taskflow for the TaskStepper by starting myTask\
// useState([]) in parent for Tasks seems a good approach but will require changes for Stepper

// Get two requests with step=response
// The first task is being updates with the content of the second task. setVisitedStepperTasks

// Why does the task for TaskShowResponse disappear when using back ?

function TaskStepper(props) {

  const {
    log,
    task, 
    setTask, 
    component_depth,
    startTaskLoading,
    startTaskError,
    startTask,
    setStartTaskId,
  } = props

  const [activeTask, setActiveTaskAfter] = useState();
  const [activeTaskIdx, setActiveTaskIdx] = useState(0);
  const [prevActiveTask, setPrevActiveTask] = useState();
  const [visitedStepperTasks, setVisitedStepperTasksWrapped] = useState([]);
  const [leaving, setLeaving] = useState();
  const [fetchNow, setFetchNow] = useState();
  const [expanded, setExpanded] = useState(['start']);
  // Here we component_depth + 1 but should be in the code ? fetch_depth state
  const { fetchResponse, fetched } = useFetchTask(fetchNow, component_depth + 1);
  const [myTask, setMyTask] = useState();
  const [childTask, setChildTask] = useState();

  useEffect(() => {
    setStartTaskId(task.id)
  }, []);

  useEffect(() => {
    if (startTask) {
      setChildTask(startTask)
      setVisitedStepperTasks([startTask])
    }
  }, [startTask]);

  /*
  // Not using myTask
  useEffect(() => {
    if (!myTask) {
      setFetchStart('root.components.TaskStepper.start', task.threadId)
    }
  }, []);

  useEffect(() => {
    if (fetchResponseStart) {
      setMyTask(fetchResponseStart)
    }
  }, [fetchResponseStart]);
  */

  // When task is done then fetch next task
  // Detecting changes of the workflow
  useEffect(() => {
    if (activeTask && !fetchNow && activeTask.done) {
      console.log("fetchNow because " + activeTask.name + " is done")
      // Store the current value in setVisitedStepperTasks so we have user input etc
      setVisitedStepperTasks((prevVisitedTasks) => {
        const updatedTasks = [...prevVisitedTasks]; // create a copy of the previous state array
        const prev = {... activeTask, done: false}
        updatedTasks[updatedTasks.length - 1] = prev; // update the last element of the copy
        return updatedTasks; // return the updated array
      });
      setFetchNow(activeTask)
    }
  }, [activeTask, fetchNow]);

  // Detect when a new task has been fetched
  useEffect(() => {
    if (fetchResponse) {
      setFetchNow(null)
      // We need to remove a level of the component stack from the activeComponent
      // setActiveTask(fetchResponse);
      // Cannot immediately use activeTask
      console.log("Fetched task " + fetchResponse.name)
      // Do we need this condition ?
      if (!leaving || leaving.direction === 'next') { // !leaving when starting
        setActiveTaskIdx(visitedStepperTasks.length)
        setVisitedStepperTasks((prevVisitedTasks) => [...prevVisitedTasks, fetchResponse ]);
        
      } else {
        // This does not look right if we are going to prev then should not be fetching
        console.error("SHOULD NOT BE HERE")
       }
    }
  }, [fetchResponse]); // Can't use fetched here as going back in stepper does not update fetched (id)

  function handleStepperNavigation(currentTask, action) {
    const currentTaskData = activeTask // tasks[currentTask];
    if (action === 'next') {
      if (currentTaskData && currentTaskData.next) {
        // Give control to the active Task which will call taskDone to transition to next state
        setLeaving({direction: 'next', task: currentTask});
        // Expect taskDone to be called from Task, rename leaving to taskLeave
      }
    } else if (action === 'back') {
      if (currentTaskData) { 
        const prev = visitedStepperTasks[visitedStepperTasks.length - 2];
        // By updating leaving this ensure there is an event if next is activated
        setLeaving({direction: 'prev', task: currentTask});
        // Could cause problem if currently fetching, can this be a function call?
        //setFetchNow(prev)
        //setActiveTask(prev);
        setActiveTaskIdx(visitedStepperTasks.length - 2)
        setVisitedStepperTasks((prevVisitedTasks) => prevVisitedTasks.slice(0, -1));
      }
    }
  }
 
  useEffect(() => {
    if (activeTask) {
      if (activeTask.id !== prevActiveTask?.id) {
        console.log("activeTask " + activeTask.name + " prevActiveTask " + prevActiveTask?.name)
        setExpanded((prevExpanded) => [...prevExpanded, activeTask.name]);
        if (prevActiveTask) {
          setExpanded((prevExpanded) => prevExpanded.filter((p) => p !== prevActiveTask.name));
        }
        setPrevActiveTask(activeTask)
      }
    }
  }, [activeTask]); 

  /*
  useEffect(() => {
    if (task) {
      setActiveTask(task)
      setVisitedStepperTasks([task])
      setActiveTaskIdx(0)
    }
  },[]);
  */

  function setVisitedStepperTasks(t) {
    console.log("setVisitedStepperTasks " + activeTaskIdx)
    setVisitedStepperTasksWrapped(t)
  }

  const handleChange = (panel) => (event, newExpanded) => {
    if (newExpanded) {
      setExpanded((prevExpanded) => [...prevExpanded, panel]);
    } else {
      setExpanded((prevExpanded) => prevExpanded.filter((p) => p !== panel));
    }
  };

  const isExpanded = (panel) => expanded.includes(panel);

  function setTaskWrapper(t) {
    console.log("setTaskWrapper " + activeTaskIdx)
    // log the activeTaskIdx it must be misaligned
    setVisitedStepperTasks((prevVisitedTasks) => {
      const updatedTasks = [...prevVisitedTasks]; // create a copy of the previous state array
      const updatedTask = typeof t === 'function' ? t(updatedTasks[activeTaskIdx]) : t;
      updatedTasks[activeTaskIdx] = updatedTask;
      return updatedTasks; // return the updated array
    });
  }

  useEffect(() => {
    setActiveTaskAfter(visitedStepperTasks[activeTaskIdx])
  },[visitedStepperTasks, activeTaskIdx]);

  function setActiveTask(t) {
    setTaskWrapper(t)
  }

  // Tracing
  useEffect(() => {
    console.log("activeTaskIdx " + activeTaskIdx)
  }, [activeTaskIdx]); 
  
  useEffect(() => {
    console.log("visitedStepperTasks ", visitedStepperTasks)
  }, [visitedStepperTasks]); 

  return (
    <div>
      <Stepper activeStep={visitedStepperTasks.indexOf(activeTask)}>
        {visitedStepperTasks.map(({ name, label }) => (
          <Step key={`task-${name}`}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      { visitedStepperTasks.map(({ name, label, component, next }, idx) => (
          <Accordion key={name} expanded={isExpanded(name)} onChange={handleChange(name)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{label}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              { /* Could pass in a key to DynamicComponent */}
              { component && (
                <DynamicComponent is={component[component_depth]} task={visitedStepperTasks[idx]} setTask={setTaskWrapper} leaving={leaving} parentTask={myTask} component_depth={component_depth} />
              )}
            </AccordionDetails>
            <div>
              {activeTask && activeTask.name !== 'start' && activeTask.name === name && (
                <Button onClick={() => handleStepperNavigation(activeTask, 'back')} variant="contained" color="primary">
                  Back
                </Button>
              )}
              {!/\.stop$/.test(next) && activeTask && activeTask.name === name && (
                <Button onClick={() => handleStepperNavigation(activeTask, 'next')} variant="contained" color="primary">
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

export default withTask(withDebug(TaskStepper));
