import React, { useEffect, useState } from 'react';
import { Typography } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl, sessionId } from '../../App';

const TaskChoose = (props) => {
    const [fetchedId, setFetchedId] = useState('');
    const [response, setResponse] = useState('');
    const [myStepKey, setMyStepKey] = useState("");

    useEffect(() => {
        setMyStepKey(props.stepKey)
    }, []);
    
    // Note the we don't really need to fetch as the text is in the exrecise definition
    useEffect(() => {
        if (props.id === fetchedId) {return}
        setFetchedId(props.id)
        // Fetch the text
        // From the step we can find the workflow?
        console.log("Fething TaskChoose")
        fetch(`${serverUrl}api/step?sessionId=${sessionId}&step_id=${props?.id}`, {
            credentials: 'include'
        })
        .then((response) => {
            return response.json()
        })
        .then((response_step) => {
            // If we have moved to a different step then we need to let the stepper know
            // This API access should be in the stepper
            if (response_step.id !== props.step.id ) {
                console.log("The server has advanced the step from " + props.step.id + " to " + response_step.id)
                // THis is hacky, shouldallow step to any step
                let [workflow_id, stepKey] = response_step.id.match(/^(.*)\.(.*)/).slice(1);
                // myStepKey was not updated
                if (!myStepKey) {
                    props.taskDone(props.stepKey)
                    console.log("props.taskDone(myStepKey, stepKey) myStepKey " + myStepKey + " stepKey " + stepKey)
                } else {
                    props.taskDone(myStepKey)
                    console.log("props.taskDone(props.stepKey, stepKey) props.stepKey " + props.stepKey + " stepKey " + stepKey)
                }
            } else {
                console.log("HERE response_step.id " + response_step.id + " props.step.id " +  props.step.id)
            }
            props.updateStep(response_step)
            if (response_step?.error) {
                setResponse("ERROR " + response_step?.error);
            } else if (response_step?.response) {
                setResponse(response_step?.response);
            }
        })
        .catch((err) => {
            console.log("ERROR " + err.message);
        });
    }, [props.step, fetchedId, myStepKey]);

    useEffect(() => {
        if (props.leaving?.step === myStepKey) {
            console.log("taskDOne due to props.leaving")
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

export default React.memo(TaskChoose);