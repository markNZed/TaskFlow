import React, { useEffect, useState } from 'react';
import { Typography } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl, sessionId } from '../../App';

const TaskShowResponse = (props) => {
    const [response, setResponse] = useState('');
    const [myStepKey, setMyStepKey] = useState("");

    useEffect(() => {
        setMyStepKey(props.stepKey)
    }, []);
    
    // Note the we don't really need to fetch as the text is in the exrecise definition
    useEffect(() => {
        // Fetch the text
        // From the step we can find the workflow?
        fetch(`${serverUrl}api/step?sessionId=${sessionId}&component=TaskShowResponse&step_id=${props?.id}`, {
            credentials: 'include'
        })
        .then((response) => response.json())
        .then((data) => {
            if (data?.response) {
                setResponse(data?.response);
            }
        })
        .catch((err) => {
            console.log(err.message);
        });
    }, []);

    useEffect(() => {
        if (props.leaving?.step === myStepKey) {
            props.taskDone(props.leaving.step)
        }
    }, [ props.leaving])

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