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
import useFetchStart from '../../hooks/useFetchStart';
import DynamicComponent from "./../Generic/DynamicComponent";

// Typically this Task gets created at the start of a taskflow
// The startTask is the task that caused the creation of this task
// Here we start a taskflow for the TaskStepper by starting myTask
function TaskStepper(props) {

  const { startTask, setStartTask} = props;
  const [activeTask, setActiveTask] = useState();
  const [prevActiveTask, setPrevActiveTask] = useState();
  const [visitedStepperTasks, setVisitedStepperTasks] = useState([]);
  const [leaving, setLeaving] = useState();
  const [fetchNow, setFetchNow] = useState();
  const [expanded, setExpanded] = useState(['start']);
  const { fetchResponse, fetched } = useFetchTask(fetchNow);
  const [fetchStart, setFetchStart] = useState();
  const { fetchResponse: fetchResponseStart } = useFetchStart(fetchStart);
  const [myTask, setMyTask] = useState();

  useEffect(() => {
    if (!myTask) {
      setFetchStart('root.ui.TaskStepper.start', startTask.threadId)
    }
  }, []);

  useEffect(() => {
    if (fetchResponseStart) {
      setMyTask(fetchResponseStart)
    }
  }, [fetchResponseStart]);

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
      setActiveTask(fetchResponse);
      // Cannot immediately use activeTask
      console.log("Fetched task " + fetchResponse.name)
      if (!leaving || leaving.direction === 'next') { // !leaving when starting
        setVisitedStepperTasks((prevVisitedTasks) => [...prevVisitedTasks, fetchResponse ]);
      } else {
        // This does not look right if we are going to prev then should not be fetching
        console.log("SHOULD NOT BE HERE?")
        setVisitedStepperTasks((prevVisitedTasks) => prevVisitedTasks.slice(0, -1));
      }
    }
  }, [fetchResponse]); // Can't use fetched here as going back in stepper does not update fetched (id)

  useEffect(() => {
    console.log("fetchNow ", fetchNow)
    console.log("fetched ", fetched)
    console.log("fetchResponse ", fetchResponse)
  }, [fetchNow, fetched, fetchResponse]); 

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
        setActiveTask(prev);
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

  useEffect(() => {
    if (startTask) {
      setActiveTask(startTask)
      setVisitedStepperTasks([startTask])
    }
  }, [startTask]); 

  const handleChange = (panel) => (event, newExpanded) => {
    if (newExpanded) {
      setExpanded((prevExpanded) => [...prevExpanded, panel]);
    } else {
      setExpanded((prevExpanded) => prevExpanded.filter((p) => p !== panel));
    }
  };

  const isExpanded = (panel) => expanded.includes(panel);

  return (
    <div>
      <Stepper activeStep={visitedStepperTasks.indexOf(activeTask)}>
        {visitedStepperTasks.map(({ name, label }) => (
          <Step key={`task-${name}`}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {visitedStepperTasks.map(({ name, label, component, next }) => (
          <Accordion key={name} expanded={isExpanded(name)} onChange={handleChange(name)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{label}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              { component && (
                  <DynamicComponent is={component} task={activeTask} setTask={setActiveTask} leaving={leaving} parentTask={myTask} />
              )}
            </AccordionDetails>
            <div>
              {activeTask.name !== 'start' && activeTask.name === name && (
                <Button onClick={() => handleStepperNavigation(activeTask, 'back')} variant="contained" color="primary">
                  Back
                </Button>
              )}
              {!/\.stop$/.test(next) && activeTask.name === name && (
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

export default TaskStepper;
