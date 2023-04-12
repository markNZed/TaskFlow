import React, { useEffect, useState } from 'react';
import { Typography } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl, sessionId } from '../../../App';

const TaskShowResponse = (props) => {
    const { taskDone, leaving } = props;
    const [fetchedId, setFetchedId] = useState('');
    const [response, setResponse] = useState('');
    const [myStepKey, setMyStepKey] = useState("");

    useEffect(() => {
        setMyStepKey(props.stepKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Note the we don't really need to fetch as the text is in the exrecise definition
    useEffect(() => {
        if (props.id === fetchedId) {return}
        setFetchedId(props.id)
        // Fetch the text
        // From the step we can find the workflow?
        fetch(`${serverUrl}api/step?sessionId=${sessionId}&step_id=${props?.id}`, {
            credentials: 'include'
        })
        .then((response) => response.json())
        .then((data) => {
            if (data?.error) {
                setResponse("ERROR " + data?.error);
            } else if (data?.response) {
                setResponse(data?.response);
            }
        })
        .catch((err) => {
            console.log(err.message);
        });
    }, [props.id, fetchedId]);

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