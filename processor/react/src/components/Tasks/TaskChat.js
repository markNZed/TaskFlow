/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import { delta } from "../../utils/utils";
import withTask from "../../hoc/withTask";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";

import PromptDropdown from "./TaskChat/PromptDropdown";

// assets
import send from "../../assets/send.svg";

/*
Task Process
  Present textarea and dropdown for user to enter a prompt
  When prompt is submitted send the task to NodeJS Task Processor with state.current=sending
  Server sends incemental text responses by websocket updating task.response.text
  Server sends final text and terminates HTTP request with state.current=input
  Parent component is expected to:
    Display updates to task.response.text while state.current=input
    Detect state.current=sending and display/store user's prompt and set state.current=receiving ** should not be setting step in parent?
  If NodeJS Task Processor request returns (!updateTaskLoading) and state.current=receiving the websocket did not start/finish
    Update with the HTTP response so step=input

Task States
  input: get user prompt
  sending: sending user prmopt to NodeJS Task Processor
  receiving: receiving websocket response from NodeJS Task Processor
  
ToDo:
  Allow copy/paste while updating
    To allow this we need to append dom elements. 
    In chatGPT they have the same problem inside the active <p> 
    but once rendered hte <p></p> can be copied
  On the server side we still use the full conversation so this partitoning needs some thought
*/

const TaskChat = (props) => {
  const {
    log,
    updateTask,
    updateStep,
    task,
    setTask,
    component_depth,
  } = props;

  const [prompt, setPrompt] = useState("");
  const [responsePending, setResponsePending] = useState(false);
  const responseTextRef = useRef("");
  const textareaRef = useRef();
  const formRef = useRef();
  const [socketResponses, setSocketResponses] = useState([]);

  // This is the level where we are going to use the task so set the component_depth
  useEffect(() => {
    updateTask({ stackPtr: component_depth });
  }, []);

  // Note that socketResponses may not (will not) be updated on every websocket event
  // React groups setState operations and I have not undestood the criteria for this
  useEffect(() => {
    const processResponses = () => {
      setSocketResponses((prevResponses) => {
        for (const response of prevResponses) {
          const text = response.text;
          const mode = response.mode;
          switch (mode) {
            case 'delta':
              responseTextRef.current += text;
              break;
            case 'partial':
              responseTextRef.current = text;
              break;
            case 'final':
              responseTextRef.current = text;
              updateStep("input")
              setResponsePending(false);
              break;
          }
        }
        updateTask({ "response.text": responseTextRef.current });
        return []; // Clear the processed responses
      });
    };
    if (socketResponses.length > 0) {
      processResponses();
    }
  }, [socketResponses]);

  // I guess the websocket can cause events during rendering
  // Putting this in the HoC causes a warning about setting state during rendering
  usePartialWSFilter(task?.instanceId,
    (partialTask) => {
      //console.log("TaskChat usePartialWSFilter partialTask", partialTask);
      setSocketResponses((prevResponses) => [...prevResponses, partialTask.response]);
    }
  )

  useEffect(() => {
    if (task.state.deltaState === "input") {
      // Reset the request so we can use response.text for partial response
      updateTask({
        "request.input": "",
        "response.text": "",
      });
      responseTextRef.current = ""
    }
  }, [task]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!prompt) {
        return;
      }
      setResponsePending(true);
      // Set update to send to NodeJS Task Processor
      updateStep("sending");
      updateTask({ "request.input": prompt, send: true });
      // Clear the textbox
      setPrompt("");
    },
    [prompt, setPrompt]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    textarea.placeholder = "Écrivez votre prompt ici.";
  }, [prompt]);

  const handleDropdownSelect = (selectedPrompt) => {
    // Append to existing prompt text, might be better just to replace
    setPrompt((prevPrompt) => prevPrompt + selectedPrompt);
    // Submit the form
    const formNode = formRef.current;
    if (formNode) {
      // Wait for the setPrompt to take effect
      delta(() => {
        formNode.requestSubmit();
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} ref={formRef} className="msg-form">
      {task.config?.suggestedPrompts ? (
        <div style={{ textAlign: "left" }}>
          <PromptDropdown
            prompts={task.config.suggestedPrompts}
            onSelect={handleDropdownSelect}
          />
        </div>
      ) : (
        ""
      )}
      <div className="msg-textarea-button">
        <textarea
          ref={textareaRef}
          name="prompt"
          value={prompt}
          rows="1"
          cols="1"
          onChange={(e) => {
            setPrompt(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey === false) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={responsePending}
          className={
            responsePending ? "send-button not-ready" : "send-button ready"
          }
        >
          {/* The key stops React double loading the image when both img and message are updated */}
          <img
            key={send}
            src={send}
            className={responsePending ? "send-not-ready" : "send-ready"}
          />
        </button>
      </div>
    </form>
  );
};

export default withTask(TaskChat);
