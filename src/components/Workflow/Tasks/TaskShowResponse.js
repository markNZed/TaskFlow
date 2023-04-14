import React, { useEffect, useState } from 'react';
import { Typography } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl } from '../../../config';
import { useGlobalStateContext } from '../../../contexts/GlobalStateContext';

const TaskShowResponse = (props) => {
    const { globalState, updateGlobalState } = useGlobalStateContext();
    const { taskDone, leaving } = props;
    const [fetchedId, setFetchedId] = useState('');
    const [response, setResponse] = useState('');
    const [myStepKey, setMyStepKey] = useState("");
    const [myStep, setMyStep] = useState('');

    useEffect(() => {
        setMyStepKey(props.stepKey)
        setMyStep(props.step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Note the we don't really need to fetch as the text is in the exrecise definition
    useEffect(() => {
        if (!myStep) {return}
        setFetchedId(props.id)
        //console.log(props)
        // Fetch the text
        // From the step we can find the workflow?

        async function fetchData() { 

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
                .then((response) => response.json())
                .then((data) => {
                    if (data?.error) {
                        setResponse("ERROR " + data?.error);
                    } else if (data?.response) {
                        const text = data.response
                        setResponse(text);
                    }
                })
                .catch(error => console.log("ERROR " + error.message));
        }

        fetchData()           

    }, [myStep]);

    useEffect(() => {
        if (leaving?.step === myStepKey) {
            taskDone(leaving.step)
        }
    }, [ leaving ])

    return (
        <div style={{ display: "flex", flexDirection: "column"}}>
            <Paper elevation={3} 
                    style={{
                        overflow: "auto",
                        textAlign: 'justify',
                        padding: "16px",
                    }}
                >
                {response.split("\\n").map((line, index) => (
                    <Typography style={{ marginTop: "16px" }} key={index}>{line}</Typography>
                ))}
            </Paper>
        </div>
    )

}

export default React.memo(TaskShowResponse);