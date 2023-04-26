import React, { useEffect, useState, useRef } from 'react';
import { Typography, TextareaAutosize } from "@mui/material";
/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// HOC fetchStep

import Paper from '@mui/material/Paper';

import { useWebSocketContext } from '../../contexts/WebSocketContext';
import useFetchStep from '../../hooks/useFetchStep';
import { delta, withDebug, withTask } from '../../utils';

const TaskFromAgent = (props) => {
  
    const { leaving, task, setTask, component_depth} = props;

    const { webSocketEventEmitter } = useWebSocketContext();

    const [fetchNow, setFetchNow] = useState();
    const [responseText, setResponseText] = useState('');
    const [userInput, setUserInput] = useState('');
    const [showUserInput, setShowUserInput] = useState(false);
    const [userInputWordCount, setUserInputWordCount] = useState(0);
    const [responseTextWordCount, setResponseTextWordCount] = useState(0);
    const userInputRef = useRef(null);
    const [userInputHeight, setUserInputHeight] = useState(0);
    const [myTaskId, setMyTaskId] = useState();
    const [myStep, setMyStep] = useState('');
    const [myLastStep, setMyLastStep] = useState('');

    const { fetchResponse, fetched } = useFetchStep(fetchNow, task, component_depth);

    // Reset the task, seems a big extreme to access global for this (should be a prop)
    useEffect(() => {
        if (task && !myTaskId) {
            console.log("RESETING TaskFromAgent")
            setMyTaskId(task.id)
            setResponseText('')
            setUserInput('')
            setUserInputWordCount(0)
            setResponseTextWordCount(0)
            if (!task?.steps) {
                // Default sequence is to just get response based on prompt text
                setTask((p) => {return {...p, steps: {'start' : 'response', 'response' : 'stop'}}});
            }
            setMyStep('start')
        }
    }, [task]);

    // Stream to the response field (should rename e.g. response_text)
    // Need to stream the ID
    useEffect(() => {
       const handleMessage = (e) => {
            const j = JSON.parse(e.data)
            if (task?.instanceId && j?.instanceId === task.instanceId) {
                
                switch (j.mode) {
                    case 'delta':
                        setResponseText((prevResponse) => prevResponse + j.delta);
                        break;
                    case 'text':
                        setResponseText(j.text);
                        break;
                    case 'final':
                        setResponseText(j.final);
                        break;
                    default:
                        break;
                }
            }
        };
        webSocketEventEmitter.on('message', handleMessage);
        return () => {
            webSocketEventEmitter.removeListener('message', handleMessage);
        };
    }, []);

    // Sub_task state machine
    // Unique for each component that requires steps
    // Split into next_state and action - no
    useEffect(() => {
        if (myTaskId && myTaskId === task.id) {
            // leaving now always true
            const leaving_now = ((leaving?.direction === 'next') && leaving?.task.name === task.name)
            const next_step = task.steps[myStep]
            console.log("task.id " + task.id + " myStep " + myStep + " next_step " + next_step + " fetched " + fetched + " leaving_now " + leaving_now)
            switch (myStep) {
                case 'start':
                    // Next state
                    setMyStep(next_step) 
                    // Actions
                    break;
                case 'response':
                    function response_action(text) {
                        if (text) {
                            const words = text.trim().split(/\s+/).filter(Boolean)
                            setResponseTextWordCount(words.length)
                            setResponseText(text)
                            if (next_step === 'input') {
                                setShowUserInput(true)
                            }
                        } else {
                            console.log("No text for response_action in TaskFromAgent")
                        }
                    }
                    // We cache the response client side
                    if (task?.response) {
                        console.log('Response cached client side')
                        // Next state
                        setMyStep(next_step)
                        // Actions
                        response_action(task.response)
                    } else {
                        if (fetched === myStep) { 
                            setMyStep(next_step) 
                            //setFetched(null)
                        }
                        // Actions
                        // send prompt to get response from agent
                        setFetchNow(myStep)
                        // show the response
                        if (fetched === myStep) {
                            const response_text = fetchResponse.response
                            setTask((p) => {return {...p, response: response_text}});
                            response_action(response_text) 
                        }
                    }
                    break;
                case 'input':
                    // Next state
                    if (fetched === myStep) {
                        setMyStep(next_step) 
                        //setFetched(null)  // It seems this or the other ssignmen to null causes problems - race with the setFetched in the fetch function
                    }
                    // Actions
                    if (leaving_now) {
                        // Send the userInput input
                        // Upon fetched we should update task ? So we need MyTask?
                        setFetchNow(myStep)
                        console.log("setFetchNow " + myStep)
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
    }, [leaving, fetched, myStep]);

    // Align task data with userInput input
    useEffect(() => {
        if (userInput) {
            setTask((p) => {return {...p, input: userInput}});
            console.log("Updating input " + userInput)
        }
    }, [userInput]);

    // Adjust userInput input area size when input grows
    useEffect(() => {
        if (userInputRef.current) {
            setUserInputHeight(userInputRef.current.scrollHeight + 300);
        }
        // filter removes empty entry
        const words = userInput.trim().split(/\s+/).filter(Boolean)
        setUserInputWordCount(words.length);
    }, [userInput]);
  
    return (

        <div style={{ display: "flex", flexDirection: "column"}}>
            {props.task?.instruction ?
                <Paper elevation={3} 
                    style={{
                        overflow: "auto",
                        textAlign: 'left',
                        padding: "18px",
                        marginBottom: "12px",
                    }}
                >
                    <Typography style={{ marginTop: "16px" }}>{props.task.instruction}</Typography>
                </Paper>
            : ''
            }
            {responseText ?
                <>
                    <Paper elevation={3} 
                            style={{
                                overflow: "auto",
                                maxHeight: `calc(100vh - ${userInputHeight}px)`,
                                textAlign: 'justify',
                                padding: "16px",
                            }}
                        >
                        { responseText.split("\\n").map((line, index) => (
                            <Typography style={{ marginTop: "16px" }} key={index}>{line}</Typography>
                        ))}
                    </Paper>

                    <p style={{ fontSize: "12px", color: "gray", margin: "4px 0 0 0", textAlign: "left" }}>
                    {responseTextWordCount} words
                    </p>
                </>
            :
              ''
            }
            {showUserInput ?
                <div>
                    <TextareaAutosize
                        placeholder={props.task?.input_label}
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        style={{ marginTop: "16px" }}
                        ref={userInputRef}
                    />
                    <p style={{ fontSize: "12px", color: "gray", margin: "4px 0 0 0", textAlign: "left" }}>
                    {userInputWordCount} words
                    </p>
                </div>
            : ''
            }
        </div>
    )

}

export default React.memo(withTask(withDebug(TaskFromAgent)));