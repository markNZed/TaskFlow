import React, { useEffect, useState, useRef } from 'react';
import { Typography, TextareaAutosize } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl } from '../../../config';
import { useWebSocketContext } from '../../../contexts/WebSocketContext';
import { useGlobalStateContext } from '../../../contexts/GlobalStateContext';

const TaskFromAgent = (props) => {
    const { globalState, updateGlobalState } = useGlobalStateContext();
  
    const { id, leaving, taskDone, stepKey, step, updateStep, activeStep } = props;

    const { webSocketEventEmitter } = useWebSocketContext();

    const [fetched, setFetched] = useState('');
    const [fetchNow, setFetchNow] = useState('');
    const [fetchResponse, setfetchResponse] = useState('');
    const [responseText, setResponseText] = useState('');
    const [userInput, setUserInput] = useState('');
    const [showUserInput, setShowUserInput] = useState(false);
    const [userInputWordCount, setUserInputWordCount] = useState(0);
    const [responseTextWordCount, setResponseTextWordCount] = useState(0);
    const userInputRef = useRef(null);
    const [userInputHeight, setUserInputHeight] = useState(0);
    const [myStepKey, setMyStepKey] = useState('');
    const [myStep, setMyStep] = useState('');
    const [mySubStep, setMySubStep] = useState('');
    const [lastMySubStep, setLastMySubStep] = useState('');

    // Should be a utility function
    const updateMyStep = (key, value) => {
        setMyStep((prevStep) => ({
          ...prevStep,
          [key]: value,
        }));
        // Need to use updateStep to share with workflow
        //console.log("updateMyStep = (key, value)" + key + " " + value)
    };

    // Stream to the response field (should rename e.g. response_text)
    // Need to stream the ID
    useEffect(() => {
        if (myStepKey !== activeStep) {return}
        const handleMessage = (e) => {
            //console.log(e)
            const j = JSON.parse(e.data)
            if (j?.delta) {
                setResponseText((prevResponse) => prevResponse + j.delta);
            }
            if (j?.text) {
                setResponseText(j.text);
            }
            if (j?.final) {
                setResponseText(j.final);
            }
        };
        webSocketEventEmitter.on('message', handleMessage);
        return () => {
            webSocketEventEmitter.removeListener('message', handleMessage);
        };
    }, []);
        
    // myStepKey is useful as it changes once and can indicate initialization
    useEffect(() => {
        setMyStepKey(stepKey) // Should use props.step.name
        setMyStep(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initialize sub_step
    // activeStep allows us to detect when we move back into this task
    useEffect(() => {
        if (myStepKey === activeStep) {
            //console.log("Initialize sub_step for " + myStepKey)
            if (!myStep?.sub_steps) {
                // Default sequence is to just get response based on prompt text
                updateMyStep('sub_steps', {'start' : 'response', 'response' : 'stop'})
            }
            setMySubStep('start')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myStepKey, activeStep]); // stepCount removed

    // Sub_step state machine
    // Unique for each component that requires sub_steps
    // Split into next_state and action - no
    useEffect(() => {
        if (mySubStep) {
            // leaving now always true
            const leaving_now = ((leaving.direction === 'next') && leaving.step === myStepKey)
            const next_sub_Step = myStep.sub_steps[mySubStep]
            console.log("myStepKey " + myStepKey + " sub_step state machine mySubStep " + mySubStep + " next_sub_Step " + next_sub_Step + " fetched " + fetched + " leaving_now " + leaving_now)
            switch (mySubStep) {
                case 'start':
                    // Next state
                    setMySubStep(next_sub_Step) 
                    // Actions
                    break;
                case 'response':
                    function response_action(text) {
                        const words = text.trim().split(/\s+/).filter(Boolean)
                        setResponseTextWordCount(words.length)
                        setResponseText(text)
                        if (next_sub_Step === 'input') {
                            setShowUserInput(true)
                        }
                    }
                    // We cache the response client side
                    if (myStep?.response) {
                        console.log('Response cached client side')
                        // Next state
                        setMySubStep(next_sub_Step)
                        // Actions
                        response_action(myStep.response)
                    } else {
                        if (fetched === mySubStep) { 
                            setMySubStep(next_sub_Step) 
                            setFetched(null)
                        }
                        // Actions
                        // send prompt to get response from agent
                        setFetchNow(mySubStep)
                        // show the response
                        if (fetched === mySubStep) {
                            const text = fetchResponse.response
                            updateMyStep('response', text)
                            response_action(text) 
                        }
                    }
                    break;
                case 'input':
                    // Next state
                    if (fetched === mySubStep) {
                        setMySubStep(next_sub_Step) 
                        setFetched(null)
                    }
                    // Actions
                    if (leaving_now) {
                        // Send the userInput input
                        setFetchNow(mySubStep)
                        console.log("setFetchNow " + mySubStep)
                    }
                    break;
                case 'stop':
                    // Next state
                    // Actions
                    // Should defensively avoid calling taskDone twice?
                    if (leaving_now) {
                        taskDone(myStepKey)
                    }
                    break;
                default:
                    console.log('ERROR unknown sub_step : ' + mySubStep);
            }
            updateMyStep('sub_step', mySubStep)
            setLastMySubStep(mySubStep) // Useful if we want an action only performed once in a state
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leaving, fetched, mySubStep]);

    // Align step data with userInput input
    useEffect(() => {
        updateMyStep('input', userInput)
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

    // This is generic
    useEffect(() => {

        if (fetchNow) {

            console.log("Fetching TaskFromAgent myStepKey " + myStepKey + " mySubStep " + mySubStep)

            async function fetchStep() { 

                const requestOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        sessionId: globalState.sessionId,
                        step: myStep,
                    })
                };
              
                fetch(`${serverUrl}api/step_post`, requestOptions)
                    .then((response) => response.json()) // .json() returns a promise
                    .then((data) => {
                        if (data?.error) {
                            console.log("ERROR " + data.error.message)
                        } 
                        setfetchResponse(data)
                        //setMyStep(data) // Cannot do this yet
                        //console.log("data " + data)
                    })
                    .then((e) => {
                        setFetched(mySubStep)
                        //console.log("setFetched " + mySubStep)
                    })
                    .catch(error => {
                        console.log("ERROR " + error.message)
                        setFetched(mySubStep)
                    });
            }

            fetchStep()
        }
    }, [fetchNow]);

    /* Debug

    useEffect(() => {
        console.log("myStep : " + myStep?.name)
    }, [myStep]);

    useEffect(() => {
        console.log("fetchNow : " + fetchNow)
    }, [fetchNow]);

    useEffect(() => {
        console.log("stepCount : " + stepCount)
    }, [stepCount]);

    useEffect(() => {
        console.log("fetched : " + fetched)
    }, [fetched]);

    */

    return (

        <div style={{ display: "flex", flexDirection: "column"}}>
            {props.step?.instruction ?
                <Paper elevation={3} 
                    style={{
                        overflow: "auto",
                        textAlign: 'left',
                        padding: "18px",
                        marginBottom: "12px",
                    }}
                >
                    <Typography style={{ marginTop: "16px" }}>{props.step.instruction}</Typography>
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
                        placeholder={props.step?.input_label}
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

export default React.memo(TaskFromAgent);