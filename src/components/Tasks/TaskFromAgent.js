import React, { useEffect, useState, useRef } from 'react';
import { Typography, TextareaAutosize } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl, sessionId } from '../../App';
import { useWebSocket } from '../../contexts/WebSocketContext';

const TaskFromAgent = (props) => {
    
    const { websocket, webSocketEventEmitter, sendJsonMessage } = useWebSocket();

    const [fetchedId, setFetchedId] = useState('');
    const [response, setResponse] = useState("");
    const [summary, setSummary] = useState("");
    const [wordCount, setWordCount] = useState(0);
    const [textWordCount, setTextWordCount] = useState(0);
    const textareaRef = useRef(null);
    const [textareaHeight, setTextareaHeight] = useState(0);
    const [myStepKey, setMyStepKey] = useState("");
    const [myStep, setMyStep] = useState("");

    useEffect(() => {
        if (props.id === fetchedId) {return}
        const handleMessage = (e) => {
            const j = JSON.parse(e.data)
            if (j?.delta) {
                setResponse((prevResponse) => prevResponse + j.delta);
            }
            if (j?.text) {
                setResponse(j.text);
            }
            if (j?.final) {
                setResponse(j.final);
            }
        };
        webSocketEventEmitter.on('message', handleMessage);
        return () => {
            webSocketEventEmitter.removeListener('message', handleMessage);
        };
    }, [webSocketEventEmitter]);
        
    useEffect(() => {
        setMyStepKey(props.stepKey)
        setMyStep(props.step)
    }, []);

    useEffect(() => {
        if (textareaRef.current) {
            setTextareaHeight(textareaRef.current.scrollHeight + 300);
        }
    }, [summary]);

    useEffect(() => {
        if (props.id === fetchedId) {return}
        setFetchedId(props.id)
        // Fetch the text
        // From the step we can find the workflow?
        fetch(`${serverUrl}api/step?sessionId=${sessionId}&step_id=${props.id}`, {
            credentials: 'include'
        })
        .then((response) => response.json())
        .then((data) => {
            if (data?.error) {
                setResponse("ERROR " + data?.error);
            } else if (data?.response) {
                const text = data.response
                const words = text.trim().split(/\s+/).filter(Boolean)
                setTextWordCount(words.length)
                setResponse(text);
            }
        })
        .catch((err) => {
            console.log(err.message);
        });
    }, [props.id, fetchedId]);

    useEffect(() => {
        if ((props.leaving.direction === 'next') && props.leaving.step === myStepKey) {

            console.log("props.leaving.direction " + props.leaving.direction + " props.leaving.step " + props.leaving.step)

            async function fetchData() { 

                const requestOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                    sessionId: sessionId,
                    component: 'TaskFromAgent',
                    step_id: fetchedId,
                    prev_step: props.prev_step,
                    input: summary,
                    })
                };
              
                await fetch(`${serverUrl}api/input`, requestOptions)
                    .catch(error => console.log("ERROR " + error.message));
                props.taskDone(props.leaving.step)
            }

            fetchData()           
        }
        //
    }, [ props.leaving])

    useEffect(() => {
        // filter removes empty entry
        const words = summary.trim().split(/\s+/).filter(Boolean)
        setWordCount(words.length);
    }, [summary]);

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
            {response ?
                <>
                    <Paper elevation={3} 
                            style={{
                                overflow: "auto",
                                maxHeight: `calc(100vh - ${textareaHeight}px)`,
                                textAlign: 'justify',
                                padding: "16px",
                            }}
                        >
                        { response.split("\\n").map((line, index) => (
                            <Typography style={{ marginTop: "16px" }} key={index}>{line}</Typography>
                        ))}
                    </Paper>

                    <p style={{ fontSize: "12px", color: "gray", margin: "4px 0 0 0", textAlign: "left" }}>
                    {textWordCount} words
                    </p>
                </>
            :
              ''
            }
            {myStep?.input !== undefined?
                <div>
                    <TextareaAutosize
                        placeholder={props.step?.input_label}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        style={{ marginTop: "16px" }}
                        ref={textareaRef}
                    />
                    <p style={{ fontSize: "12px", color: "gray", margin: "4px 0 0 0", textAlign: "left" }}>
                    {wordCount} words
                    </p>
                </div>
            : ''
            }
        </div>
    )

}

export default React.memo(TaskFromAgent);