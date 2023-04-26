/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from 'react';
import { Typography } from "@mui/material";
import Paper from '@mui/material/Paper';

import { withDebug, withTask } from '../../utils';

// This component is complete overkill for what it is doing but it was useful during early dev

const TaskShowResponse = (props) => {

    const { leaving, task, setTask, parentTask, updateTask, updateStep, updateTaskLoading, } = props;

    const [responseText, setResponseText] = useState('');
    const [myTaskId, setMyTaskId] = useState();
    const [myStep, setMyStep] = useState('');
    const [myLastStep, setMyLastStep] = useState('');

    // Reset the task once, we wil not need to do this if not reused
    useEffect(() => {
        //console.log("task ", task)
        if (task && !myTaskId) {
            console.log("RESETTING TaskShowResponse")
            //setMyStep('start') // I guess this triggers the state machine
            setMyTaskId(task.id)
            setResponseText('')
            if (!task?.steps) {
                // Default sequence is to just get response
                setTask((p) => {return { ...p, steps: {'start' : 'response', 'response' : 'stop'} }});
            }
            //setTask((p) => {return { ...p, step: 'start' }});
            setMyStep('start')
        }
    }, [task]);

    useEffect(() => {
        //console.log("task ", task)
    }, [task]);

    // Sub_task state machine
    // Unique for each component that requires steps
    // Split into next_state and action - no
    useEffect(() => {
        if (myTaskId && myTaskId === task.id) { // remove myTaskId rename last_step delta step
            // leaving should use id not name
            const leaving_now = ((leaving?.direction === 'next') && leaving?.task.name === task.name)
            const next_step = task.steps[myStep]
            console.log("task.id " + task.id + " myStep " + myStep + " next_step " + next_step + " leaving_now " + leaving_now)
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
                        console.log('Response cached client side')
                        // Next state
                        setMyStep(next_step)
                        // Actions
                        response_action(task.response)
                    } else {
                        // This effectively waits for the update
                        if (task.updated) { 
                            setMyStep(next_step) 
                            //setFetched(null)
                            const response_text = task.response
                            setTask((p) => {return {...p, response: response_text}});
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
                    //setFetched(null) // This also breaks things, even clearFetch state does not work
                    if (leaving_now) {
                        setTask((p) => {return {...p, done: true}});
                    }
                    break;
                default:
                    console.log('ERROR unknown step : ' + myStep);
            }
            setTask((p) => {return {...p, step: myStep}});
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

export default React.memo(withTask(withDebug(TaskShowResponse)));