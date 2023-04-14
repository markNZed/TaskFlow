import React, { useEffect, useState, useRef } from 'react';
import { Typography, TextareaAutosize } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl } from '../../../config';
import { useWebSocketContext } from '../../../contexts/WebSocketContext';
import { useGlobalStateContext } from '../../../contexts/GlobalStateContext';

const TaskFromAgent = (props) => {
    const { globalState, updateGlobalState } = useGlobalStateContext();
  
    const { id, leaving, taskDone, taskName, task, updateTask, activeTask } = props;

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
    const [myTaskName, setMyTaskName] = useState('');
    const [myTask, setMyTask] = useState('');
    const [myStep, setMyStep] = useState('');
    const [myLastStep, setMyLastStep] = useState('');

    // Should be a utility function
    const updateMyTask = (key, value) => {
        setMyTask((prevTask) => ({
          ...prevTask,
          [key]: value,
        }));
        // Need to use updateTask to share with workflow
        //console.log("updateMyTask = (key, value)" + key + " " + value)
    };

    // Stream to the response field (should rename e.g. response_text)
    // Need to stream the ID
    useEffect(() => {
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
        
    // myTaskName is useful as it changes once and can indicate initialization
    useEffect(() => {
        setMyTaskName(taskName) // Should use props.task.name
        setMyTask(task)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initialize step
    // activeTask allows us to detect when we move back into this task
    useEffect(() => {
        if (myTaskName === activeTask) {
            //console.log("Initialize step for " + myTaskName)
            if (!myTask?.steps) {
                // Default sequence is to just get response based on prompt text
                updateMyTask('steps', {'start' : 'response', 'response' : 'stop'})
            }
            setMyStep('start')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myTaskName, activeTask]); // taskCount removed

    // Sub_task state machine
    // Unique for each component that requires steps
    // Split into next_state and action - no
    useEffect(() => {
        if (myStep) {
            // leaving now always true
            const leaving_now = ((leaving.direction === 'next') && leaving.task === myTaskName)
            const next_step = myTask.steps[myStep]
            console.log("myTaskName " + myTaskName + " step state machine myStep " + myStep + " next_step " + next_step + " fetched " + fetched + " leaving_now " + leaving_now)
            switch (myStep) {
                case 'start':
                    // Next state
                    setMyStep(next_step) 
                    // Actions
                    break;
                case 'response':
                    function response_action(text) {
                        const words = text.trim().split(/\s+/).filter(Boolean)
                        setResponseTextWordCount(words.length)
                        setResponseText(text)
                        if (next_step === 'input') {
                            setShowUserInput(true)
                        }
                    }
                    // We cache the response client side
                    if (myTask?.response) {
                        console.log('Response cached client side')
                        // Next state
                        setMyStep(next_step)
                        // Actions
                        response_action(myTask.response)
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
                            updateMyTask('response', response_text)
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
                        setFetchNow(myStep)
                        console.log("setFetchNow " + myStep)
                    }
                    break;
                case 'stop':
                    // Next state
                    // Actions
                    // Should defensively avoid calling taskDone twice?
                    // setFetched(null) // unsure about this, should be OK
                    if (leaving_now) {
                        taskDone(myTaskName)
                    }
                    break;
                default:
                    console.log('ERROR unknown step : ' + myStep);
            }
            updateMyTask('step', myStep)
            setMyLastStep(myStep) // Useful if we want an action only performed once in a state
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leaving, fetched, myStep]);

    // Align task data with userInput input
    useEffect(() => {
        updateMyTask('input', userInput)
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

            console.log("Fetching TaskFromAgent myTaskName " + myTaskName + " myStep " + myStep)

            async function fetchTask() { 

                const requestOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        sessionId: globalState.sessionId,
                        task: myTask,
                    })
                };
              
                fetch(`${serverUrl}api/task_post`, requestOptions)
                    .then((response) => response.json()) // .json() returns a promise
                    .then((data) => {
                        if (data?.error) {
                            console.log("ERROR " + data.error.message)
                        } 
                        setfetchResponse(data)
                        //setMyTask(data) // Cannot do this yet
                        //console.log("data " + data)
                    })
                    .then((e) => {
                        setFetched(myStep)
                        //console.log("setFetched " + myStep)
                    })
                    .catch(error => {
                        console.log("ERROR " + error.message)
                        setFetched(myStep)
                    });
            }

            fetchTask()
        }
    }, [fetchNow]);

    /* Debug

    useEffect(() => {
        console.log("myTask : " + myTask?.name)
    }, [myTask]);

    useEffect(() => {
        console.log("fetchNow : " + fetchNow)
    }, [fetchNow]);

    useEffect(() => {
        console.log("taskCount : " + taskCount)
    }, [taskCount]);

    useEffect(() => {
        console.log("fetched : " + fetched)
    }, [fetched]);

    */

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

export default React.memo(TaskFromAgent);