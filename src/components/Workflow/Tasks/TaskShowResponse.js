import React, { useEffect, useState } from 'react';
import { Typography } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl } from '../../../config';
import { useGlobalStateContext } from '../../../contexts/GlobalStateContext';
import useFetchTask from '../../../hooks/useFetchTask';

const TaskShowResponse = (props) => {

    const { id, leaving, taskDone, taskName, task, updateTask, activeTask } = props;
    const { globalState, updateGlobalState } = useGlobalStateContext();

    const [fetchNow, setFetchNow] = useState('');
    const [responseText, setResponseText] = useState('');
    const [myTaskName, setMyTaskName] = useState("");
    const [myTask, setMyTask] = useState('');
    const [myStep, setMyStep] = useState('');
    const [myLastStep, setMyLastStep] = useState('');

    const { fetchResponse, fetched } = useFetchTask(fetchNow, myTask, myStep, globalState, serverUrl);

    // Should be a utility function
    const updateMyTask = (key, value) => {
        setMyTask((prevTask) => ({
          ...prevTask,
          [key]: value,
        }));
        // Need to use updateTask to share with workflow
        //console.log("updateMyTask = (key, value)" + key + " " + value)
    };

    useEffect(() => {
        setMyTaskName(props.taskName)
        setMyTask(props.task)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initialize step
    // activeTask allows us to detect when we move back into this task
    useEffect(() => {
        if (myTaskName === activeTask) {
            //console.log("Initialize step for " + myTaskName)
            if (!myTask?.steps) {
                // Default sequence is to just get response
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
            const leaving_now = ((leaving?.direction === 'next') && leaving?.task === myTaskName)
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
                        setResponseText(text);
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
                case 'stop':
                    // Next state
                    // Actions
                    // Should defensively avoid calling taskDone twice?
                    //setFetched(null) // This also breaks things, even clearFetch state does not work
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

export default React.memo(TaskShowResponse);