import React, { useState, useEffect } from "react";
import { Stepper, Step, StepLabel, Typography, Button } from "@mui/material";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TaskFromAgent from "./Tasks/TaskFromAgent"
import TaskShowResponse from "./Tasks/TaskShowResponse"
import { useGlobalStateContext } from '../../contexts/GlobalStateContext';

import { serverUrl } from '../../config';

function WorkflowStepper(props) {
  const { globalState, updateGlobalState } = useGlobalStateContext();
  const { selectedworkflow } = props;
  const [activeStep, setActiveStep] = useState('start');
  const [prevActiveStep, setPrevActiveStep] = useState('start');
  const [serverStep, setServerStep] = useState(null);
  const [steps, setSteps] = useState({});
  const [visitedSteps, setVisitedSteps] = useState([]);
  const [leaving, setLeaving] = useState(null);
  const [expanded, setExpanded] = useState(['start']);
  const [myStepKey, setMyStepKey] = useState("");

  function handleStepNavigation(currentStep, action) {
    const currentStepData = steps[currentStep];
  
    if (action === 'next') {
      // Check if the next step is defined and update the active step accordingly
      if (currentStepData && currentStepData.next) {
        setLeaving({direction: 'next', step: currentStep});
        // Expect taskDone to be called from Task, rename leaving to taskLeave
      }
    } else if (action === 'back') {
      // Check if the previous step is defined and update the active step accordingly
      if (currentStepData) { 
        const prev = visitedSteps[visitedSteps.length - 2];
        setActiveStep(prev);
        setVisitedSteps((prevVisitedSteps) => prevVisitedSteps.slice(0, -1));
      }
    }
  }

  function taskDone(currentStep) {
    const currentStepData = steps[currentStep];
    var nextStepKey = currentStepData.next
    // Check if the next step is defined and update the active step accordingly
    if (currentStepData) {
      if (steps[nextStepKey]?.server_step) {
        console.log("Server step " + nextStepKey)
        setServerStep(nextStepKey);
      } else {
        setActiveStep(nextStepKey);
        console.log("Client step " + nextStepKey)
          // Add the next step to the visited steps list
        setVisitedSteps((prevVisitedSteps) => [...prevVisitedSteps, nextStepKey]);
      }
    } else {
      console.log("Unexpected no next step in " + currentStep)
    }
  }

  useEffect(() => {
    if (steps[activeStep] && steps[activeStep].next === serverStep) {
      async function fetchData() { 
        let id = selectedworkflow?.id + '.' + serverStep
        let updatedStep = await fetch(`${serverUrl}api/step?sessionId=${globalState.sessionId}&step_id=${id}`, {
          credentials: 'include'
        })
        .then((response) => response.json())
        .catch((err) => {
            console.log(err.message);
        });
        setServerStep(null)
        //updateStep(updatedStep)
        let tmpSteps = JSON.parse(JSON.stringify(steps)); // deep copy 
        tmpSteps[serverStep] = updatedStep
        setSteps(tmpSteps)
        setActiveStep(updatedStep.next)
        console.log("Client step after server step " + updatedStep.next)
        setVisitedSteps((prevVisitedSteps) => [...prevVisitedSteps, updatedStep.next]);
      }
      fetchData()
    }
  }, [steps, setSteps, serverStep, activeStep, setActiveStep, selectedworkflow]);     

  
  useEffect(() => {
    if (activeStep !== prevActiveStep) {
      console.log("activeStep " + activeStep)
      setExpanded((prevExpanded) => [...prevExpanded, activeStep]);
      if (prevActiveStep) {
        console.log("prevActiveStep " + prevActiveStep)
        setExpanded((prevExpanded) => prevExpanded.filter((p) => p !== prevActiveStep));
      }
      setPrevActiveStep(activeStep)
    }
  }, [activeStep, prevActiveStep, setPrevActiveStep]); 
  

  function updateStep(step) {
    let tmpSteps = JSON.parse(JSON.stringify(steps)); // deep copy 
    tmpSteps[activeStep] = step
    setSteps(tmpSteps)
  }

  useEffect(() => {
    if (props.selectedworkflow?.steps) {
      setSteps(props.selectedworkflow?.steps)
      setVisitedSteps(['start'])
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
      <Stepper activeStep={visitedSteps.indexOf(activeStep)}>
        {visitedSteps.map((stepKey) => (
          <Step key={`step-${stepKey}`}>
            <StepLabel>{steps[stepKey].label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {visitedSteps.map((stepKey) => (
          <Accordion key={stepKey} expanded={isExpanded(stepKey)} onChange={handleChange(stepKey)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{steps[stepKey].label}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              { /* stepKey */ }
              {(() => {
                switch (steps[stepKey].component) {
                  case 'TaskFromAgent':
                    return <TaskFromAgent stepKey={stepKey} step={steps[stepKey]} id={props.selectedworkflow?.id + '.' + stepKey} leaving={leaving} taskDone={taskDone} updateStep={updateStep}/>;
                  case 'TaskShowResponse':
                    return <TaskShowResponse  stepKey={stepKey} step={steps[stepKey]} id={props.selectedworkflow?.id + '.' + stepKey} leaving={leaving} taskDone={taskDone} updateStep={updateStep}/>;
                  case 'TaskChoose':
                    return '' // ServerSide
                  case 'ServerSide':
                    return ''
                  default:
                    return <div> No task found for {stepKey} {steps[stepKey].component}</div>
                }
              })()}   
            </AccordionDetails>
            <div>
              {activeStep !== 'start' && activeStep === stepKey && (
                <Button onClick={() => handleStepNavigation(activeStep, 'back')} variant="contained" color="primary">
                  Back
                </Button>
              )}
              {!/^stop/.test(steps[activeStep].next) && activeStep === stepKey && (
                <Button onClick={() => handleStepNavigation(activeStep, 'next')} variant="contained" color="primary">
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
