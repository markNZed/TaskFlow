import React, { useState, useEffect } from "react";
import { Stepper, Step, StepLabel, Typography, Button } from "@mui/material";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TaskFromAgent from "./Tasks/TaskFromAgent"
import TaskShowResponse from "./Tasks/TaskShowResponse"
import { useGlobalStateContext } from '../../contexts/GlobalStateContext';

import { serverUrl } from '../../config';

function WorkflowStepper(props) {
  const { globalState } = useGlobalStateContext();
  const { selectedworkflow } = props;
  const [activeTask, setActiveTask] = useState('start');
  const [prevActiveTask, setPrevActiveTask] = useState('start');
  const [serverTask, setServerTask] = useState(null);
  const [tasks, setTasks] = useState({});
  const [visitedStepperSteps, setVisitedTasks] = useState([]);
  const [leaving, setLeaving] = useState(null);
  const [expanded, setExpanded] = useState(['start']);

  function handleStepperNavigation(currentTask, action) {
    const currentTaskData = tasks[currentTask];
    if (action === 'next') {
      if (currentTaskData && currentTaskData.next) {
        // Give control to the active Task which will call taskDone to transition to next state
        setLeaving({direction: 'next', task: currentTask});
        // Expect taskDone to be called from Task, rename leaving to taskLeave
      }
    } else if (action === 'back') {
      if (currentTaskData) { 
        const prev = visitedStepperSteps[visitedStepperSteps.length - 2];
        // By updating leeacing this ensure there is an event if next is activated
        setLeaving({direction: 'prev', task: currentTask});
        setActiveTask(prev);
        setVisitedTasks((prevVisitedTasks) => prevVisitedTasks.slice(0, -1));
      }
    }
  }

  function taskDone(currentTask) {
    const currentTaskData = tasks[currentTask];
    var nextTaskName = currentTaskData.next
    // Check if the next task is defined and update the active task accordingly
    if (currentTaskData) {
      if (tasks[nextTaskName]?.server_task) {
        console.log("Server task " + nextTaskName)
        setServerTask(nextTaskName);
        // Perhaps setActiveTask(null) to deal with returning to an task after server side
      } else {
        setActiveTask(nextTaskName);
        console.log("Client task " + nextTaskName)
          // Add the next task to the visited tasks list
        setVisitedTasks((prevVisitedTasks) => [...prevVisitedTasks, nextTaskName]);
      }
    } else {
      console.log("Unexpected no next task in " + currentTask)
    }
  }

  useEffect(() => {
    if (tasks[activeTask] && tasks[activeTask].next === serverTask) {

       // Note this is using tasks[serverTask] may be an argument
      async function fetchData() { 

        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
            sessionId: globalState.sessionId,
            task: tasks[serverTask],
            })
        };
      
        let updatedTask = await fetch(`${serverUrl}api/task`, requestOptions)
            .then((response) => response.json())
            .catch((err) => {
                console.log(err.message);
            });

        setServerTask(null)
        let tmpTasks = JSON.parse(JSON.stringify(tasks)); // deep copy 
        tmpTasks[serverTask] = updatedTask
        setTasks(tmpTasks)
        setActiveTask(updatedTask.next)
        console.log("Client task after server task " + updatedTask.next)
        setVisitedTasks((prevVisitedTasks) => [...prevVisitedTasks, updatedTask.next]);
      }

      fetchData()
    }
  }, [tasks, setTasks, serverTask, activeTask, setActiveTask, selectedworkflow]);     

  
  useEffect(() => {
    if (activeTask !== prevActiveTask) {
      console.log("activeTask " + activeTask)
      setExpanded((prevExpanded) => [...prevExpanded, activeTask]);
      if (prevActiveTask) {
        console.log("prevActiveTask " + prevActiveTask)
        setExpanded((prevExpanded) => prevExpanded.filter((p) => p !== prevActiveTask));
      }
      setPrevActiveTask(activeTask)
    }
  }, [activeTask, prevActiveTask, setPrevActiveTask]); 
  

  function updateTask(task) {
    let tmpTasks = JSON.parse(JSON.stringify(tasks)); // deep copy 
    tmpTasks[activeTask] = task
    setTasks(tmpTasks)
  }

  useEffect(() => {
    if (props.selectedworkflow?.tasks) {
      setTasks(props.selectedworkflow?.tasks)
      setVisitedTasks(['start'])
    }
  }, [props.selectedworkflow]); 

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
      <Stepper activeStep={visitedStepperSteps.indexOf(activeTask)}>
        {visitedStepperSteps.map((taskName) => (
          <Step key={`task-${taskName}`}>
            <StepLabel>{tasks[taskName].label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {visitedStepperSteps.map((taskName) => (
          <Accordion key={taskName} expanded={isExpanded(taskName)} onChange={handleChange(taskName)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{tasks[taskName].label}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              { /* taskName */ }
              {(() => {
                switch (tasks[taskName].component) {
                  case 'TaskFromAgent':
                    return <TaskFromAgent taskName={taskName} task={tasks[taskName]} id={props.selectedworkflow?.id + '.' + taskName} leaving={leaving} taskDone={taskDone} updateTask={updateTask} activeTask={activeTask}/>;
                  case 'TaskShowResponse':
                    return <TaskShowResponse  taskName={taskName} task={tasks[taskName]} id={props.selectedworkflow?.id + '.' + taskName} leaving={leaving} taskDone={taskDone} updateTask={updateTask} activeTask={activeTask}/>;
                  case 'TaskChoose':
                    return '' // ServerSide
                  case 'ServerSide':
                    return ''
                  default:
                    return <div> No task found for {taskName} {tasks[taskName].component}</div>
                }
              })()}   
            </AccordionDetails>
            <div>
              {activeTask !== 'start' && activeTask === taskName && (
                <Button onClick={() => handleStepperNavigation(activeTask, 'back')} variant="contained" color="primary">
                  Back
                </Button>
              )}
              {!/^stop/.test(tasks[activeTask].next) && activeTask === taskName && (
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

export default WorkflowStepper;
