/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import { Typography } from "@mui/material";
import Paper from "@mui/material/Paper";
import withTask from "../../hoc/withTask";
import { replaceNewlinesWithParagraphs } from "../../utils/utils";

/*
Task Process
  This component is complete overkill for what it is doing but it was useful during early dev
  Fetches a response from the NodeJS Task Processor that is hard coded in the task
  
ToDo:
  
*/

const TaskShowResponse = (props) => {
  const {
    log,
    task,
    modifyTask,
    modifyState,
    transition,
    onDidMount,
  } = props;

  const [responseText, setResponseText] = useState("");

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  // Each time this component is mounted then we reset the task state
  useEffect(() => {
    // This can write over the update
    task.state.current = "start";
  }, []);

  // Task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (task) {
      let nextState;
      if (transition()) { log("TaskShowResponse State Machine State " + task.state.current) }
      switch (task.state.current) {
        case "start":
          if (task.response.text) {
            log("Response cached React Task Processor side");
            nextState = "response";
          }
          break;
        case "response":
          if (responseText !== task.response.text) {
            setResponseText(task.response.text);
          }
          if (task.exit) {
            modifyTask({ "state.done": true });
            nextState = "exit";
          }
          break;
        case "exit":
          break
        default:
          console.log("ERROR unknown state : " + task.state.current);
      }
      // Manage state.current and state.last
      modifyState(nextState);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Paper
        elevation={3}
        style={{
          overflow: "auto",
          textAlign: "justify",
          padding: "16px",
        }}
      >
        {responseText && responseText.split("\\n").map((line, index) => (
          <Typography 
            style={{ marginTop: "16px" }} 
            key={index}
            className="text2html"
            dangerouslySetInnerHTML={{ __html: replaceNewlinesWithParagraphs(line) }}
          />
        ))}
      </Paper>
    </div>
  );
};

export default withTask(TaskShowResponse);
