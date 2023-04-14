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
    const [myTaskName, setMyTaskName] = useState("");
    const [myTask, setMyTask] = useState('');

    useEffect(() => {
        setMyTaskName(props.taskName)
        setMyTask(props.task)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Note the we don't really need to fetch as the text is in the exrecise definition
    useEffect(() => {
        if (!myTask) {return}
        setFetchedId(props.id)
        //console.log(props)
        // Fetch the text
        // From the task we can find the workflow?

        async function fetchData() { 

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

    }, [myTask]);

    useEffect(() => {
        if (leaving?.task === myTaskName) {
            taskDone(leaving.task)
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