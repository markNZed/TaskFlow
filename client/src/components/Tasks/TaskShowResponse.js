/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from 'react';
import { Typography } from "@mui/material";
import Paper from '@mui/material/Paper';

import withTask from '../../hoc/withTask';

// 


/*
Task Process
  This component is complete overkill for what it is doing but it was useful during early dev
  Fetches a response from the server that is hard coded in the task
  
ToDo:
  
*/

const TaskShowResponse = (props) => {

    const { log, leaving, task, setTask, parentTask, updateTask, updateStep, updateTaskLoading, component_depth, updateTaskV2 } = props;

    const [responseText, setResponseText] = useState('');
    const [myTaskId, setMyTaskId] = useState();
    const [myStep, setMyStep] = useState('');
    const [myLastStep, setMyLastStep] = useState('');

    // This is the level where we are going to use the task so set the component_depth
    useEffect(() => {
        updateTask({component_depth : component_depth})
    }, []);

    // Reset the task. Allows for the same component to be reused for different tasks. 
    // Probably always better to associate a component with a single task.
    useEffect(() => {
        //console.log("task ", task)
        if (task && !myTaskId) {
            setMyTaskId(task.id)
            setResponseText('')
            if (!task?.steps) {
                // Default sequence is to just get response
                updateTaskV2({ 'v02.config.nextStates': {'start' : 'response', 'response' : 'stop'} })
                //setTask((p) => {return { ...p, steps: {'start' : 'response', 'response' : 'stop'} }});
            }
            setMyStep('start')
        }
    }, [task]);

    // Sub_task state machine
    // Unique for each component that requires steps
    useEffect(() => {
        if (myTaskId && myTaskId === task.id) {
            const leaving_now = ((leaving?.direction === 'next') && leaving?.task.name === task.name)
            const next_step = task.steps[myStep]
            //console.log("task.id " + task.id + " myStep " + myStep + " next_step " + next_step + " leaving_now " + leaving_now)
            switch (myStep) {
                case 'start':
                    // Next state
                    setMyStep(next_step) 
                    // Actions
                    break;
                case 'response':
                    function response_action(text) {
                        setResponseText(text);
                    }
                    // We cache the response client side
                    if (task?.response) {
                        log('Response cached client side')
                        // Next state
                        setMyStep(next_step)
                        // Actions
                        response_action(task.response)
                    } else {
                        // This effectively waits for the update
                        if (task.updated) { 
                            setMyStep(next_step) 
                            const response_text = task.response
                            updateTaskV2({ 'v02.response.text': response_text })
                            //setTask((p) => {return {...p, response: response_text}});
                            response_action(response_text) 
                        } else {
                            updateTask({update: true}) 
                        }
                    }
                    break;
                case 'stop':
                    // Next state
                    // Actions
                    // Should defensively avoid calling taskDone twice?
                    if (leaving_now) {
                        updateTaskV2({ 'v02.state.done': true })
                        //setTask((p) => {return {...p, done: true}});
                    }
                    break;
                default:
                    console.log('ERROR unknown step : ' + myStep);
            }
            updateStep(myStep)
            //setTask((p) => {return {...p, step: myStep}});
            setMyLastStep(myStep) // Useful if we want an action only performed once in a state
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leaving, myStep, task?.updated]);

    return (
        <div style={{ display: "flex", flexDirection: "column"}}>
            <Paper elevation={3} 
                    style={{
                        overflow: "auto",
                        textAlign: 'justify',
                        padding: "16px",
                    }}
                >
                {responseText.split("\\n").map((line, index) => (
                    <Typography style={{ marginTop: "16px" }} key={index}>{line}</Typography>
                ))}
            </Paper>
        </div>
    )

}

export default React.memo(withTask(TaskShowResponse));