import React, { useEffect, useState, useRef } from 'react';
import { Typography, TextareaAutosize } from "@mui/material";
import Paper from '@mui/material/Paper';

import { serverUrl, sessionId } from '../../App';

const TaskFromAgent = (props) => {
    
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
        // From the step we can find the exercise?
        fetch(`${serverUrl}api/step?sessionId=${sessionId}&component=TaskFromAgent&step_id=${props.id}&prev_step=${props.prevStep}`, {
            credentials: 'include'
        })
        .then((response) => response.json())
        .then((data) => {
            if (data?.response) {
                const text = data.response
                const words = text.trim().split(/\s+/).filter(Boolean)
                setTextWordCount(words.length)
                setResponse(text);
            }
        })
        .catch((err) => {
            console.log(err.message);
        });
    }, [props.id, fetchedId, props.prevStep]);

    useEffect(() => {
        if ((props.leaving.direction === 'next') && props.leaving.step === myStepKey) {

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
              
            fetch(`${serverUrl}api/input`, requestOptions)
                .then(response => response.json())
                .then(result => props.taskDone(props.leaving.step))
                .catch(error => console.log(error));     
            
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
            <Paper elevation={3} 
                    style={{
                        overflow: "auto",
                        maxHeight: `calc(100vh - ${textareaHeight}px)`,
                        textAlign: 'justify',
                        padding: "16px",
                    }}
                >
                {response.split("\\n").map((line, index) => (
                    <Typography style={{ marginTop: "16px" }} key={index}>{line}</Typography>
                ))}
            </Paper>
            <p style={{ fontSize: "12px", color: "gray", margin: "4px 0 0 0", textAlign: "left" }}>
              {textWordCount} words
            </p>
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