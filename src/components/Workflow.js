import React, { useState, useEffect } from "react";
import { Stepper, Step, StepLabel, Typography, Button } from "@mui/material";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TaskFromAgent from "./steps/TaskFromAgent"
import TaskShowText from "./steps/TaskShowText"

function sortStepsByNext(steps) {
  const orderedKeys = [];
  let currentKey = 'start';
  const visitedKeys = new Set();
  
  if (steps[currentKey]) {
    while (currentKey && steps[currentKey]) {
      if (visitedKeys.has(currentKey)) {
        console.error('Circular reference detected in steps:', currentKey);
        break;
      }
      visitedKeys.add(currentKey);
      orderedKeys.push(currentKey);
      currentKey = steps[currentKey]?.next;
    }
  }
  return orderedKeys.map((key) => [key, steps[key]]);
}

function Workflow(props) {
  const [activeStep, setActiveStep] = useState('start');
  const [prevStep, setPrevStep] = useState(null);
  const [steps, setSteps] = useState({});
  const [sortedSteps, setSortedSteps] = useState([]);
  const [visitedSteps, setVisitedSteps] = useState([]);
  const [leaving, setLeaving] = useState(null);

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
        setPrevStep(currentStep)
      }
    }
  }

  function taskDone(currentStep) {
    const currentStepData = steps[currentStep];
      // Check if the next step is defined and update the active step accordingly
    if (currentStepData && currentStepData.next) {
      setActiveStep(currentStepData.next);
      // Add the next step to the visited steps list
      setVisitedSteps((prevVisitedSteps) => [...prevVisitedSteps, currentStepData.next]);
      setPrevStep(currentStep)
    }
  }

  useEffect(() => {
    if (props.selectedExercise?.steps) {
      setSteps(props.selectedExercise?.steps)
      setSortedSteps(sortStepsByNext(props.selectedExercise?.steps));
      setVisitedSteps(['start'])
    }
  }, [props.selectedExercise]); 

  useEffect(() => {
    setActiveStep('start');
  }, [props.selectedExercise]);

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
          <Accordion key={stepKey} expanded={activeStep === stepKey}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{steps[stepKey].label}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(() => {
                switch (steps[stepKey].component) {
                  case 'TaskFromAgent':
                    return <TaskFromAgent stepKey={stepKey} step={steps[stepKey]} prevStep={prevStep} id={props.selectedExercise?.id + '.' + stepKey} leaving={leaving} taskDone={taskDone}/>;
                  case 'TaskShowText':
                    return <TaskShowText  stepKey={stepKey} step={steps[stepKey]} prevStep={prevStep} id={props.selectedExercise?.id + '.' + stepKey} leaving={leaving} taskDone={taskDone}/>;
                  default:
                    return <div> No task found for {steps[stepKey].component}</div>
                }
              })()}   
            </AccordionDetails>
           <div>
              {activeStep !== 'start' && (
                <Button onClick={() => handleStepNavigation(activeStep, 'back')} variant="contained" color="primary">
                  Back
                </Button>
              )}
              {!/^stop/.test(steps[activeStep].next) && (
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

export default Workflow;
