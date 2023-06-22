/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";
import PromptDropdown from "./TaskChat/PromptDropdown";
import send from "../../assets/send.svg";

/*
Task Process
  Present textarea and dropdown for user to enter a prompt
  When prompt is submitted state.current -> sending
  NodeJS sends incemental text responses by websocket updating task.response.text
  NodeJS sends final text and terminates HTTP request with state.current=input
  Parent component is expected to:
    Display updates to task.output.msgs

Task States
  input: get user prompt
  sending: sending user prmopt to NodeJS Task Processor
  receiving: receiving websocket response from NodeJS Task Processor
  
ToDo:
  Allow copy/paste while receiving
    To allow this we need to append dom elements. 
    In chatGPT they have the same problem inside the active <p> 
    but once rendered the <p></p> can be copied
  Max width for suggested prompts with wrapping possible?
*/

const TaskChat = (props) => {
  const {
    log,
    task,
    stackPtr,
    modifyTask,
    modifyState,
    transition,
    transitionTo, 
    transitionFrom, 
    user,
    onDidMount,
    componentName,
  } = props;

  const [prompt, setPrompt] = useState("");
  const [submitForm, setSubmitForm] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [responseText, setResponseText] = useState("");
  const responseTextRef = useRef("");
  const textareaRef = useRef();
  const formRef = useRef();
  const [socketResponses, setSocketResponses] = useState([]);

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  // Note that socketResponses may not (will not) be updated on every websocket event
  // React groups setState operations and I have not understood the exact criteria for this
  useEffect(() => {
    const processResponses = () => {
      setSocketResponses((prevResponses) => {
        //console.log("prevResponses.lenght", prevResponses.length);
        for (const response of prevResponses) {
          if (!response.partial) {
            continue;
          }
          const text = response.partial.text;
          const mode = response.partial.mode;
          switch (mode) {
            case 'delta':
              responseTextRef.current += text;
              break;
            case 'partial':
            case 'final':
              responseTextRef.current = text;
              break;
          }
        }
        //console.log("TaskChat processResponses responseTextRef.current:", responseTextRef.current);
        setResponseText(responseTextRef.current);
        return []; // Clear the processed socketResponses
      });
    };
    if (socketResponses.length > 0) {
      processResponses();
    }
  }, [socketResponses]);

  // I guess the websocket can cause events during rendering
  // Putting this in the HoC causes a warning about setting state during rendering
  usePartialWSFilter(task,
    (partialTask) => {
      //console.log("TaskChat usePartialWSFilter partialTask", partialTask.response);
      setSocketResponses((prevResponses) => [...prevResponses, partialTask.response]);
    }
  )

  // Task state machine
  // Need to be careful setting task in the state machine so it does not loop
  // Could add a check for this
  useEffect(() => {
    if (task) {
      let nextState;
      if (transition()) { log("TaskChat State Machine State " + task.state.current,task) }
      // Deep copy because we are going to modify the msgs array which is part of a React state
      // so it should only be modified with modifyTask
      const msgs = JSON.parse(JSON.stringify(task.output.msgs)); 
      switch (task.state.current) {
        case "input":
          if (transitionFrom("receiving")) {
            responseTextRef.current = "";
            setResponseText(responseTextRef.current);
          }
          if (submittingForm) {
            nextState = "sending";
          }
          break;
        case "sending":
          // Create a slot for new msgs
          if (transitionTo("sending")) {
            // Create a new slot for the next message
            // Add the input too for the user
            const newMsgArray = [
              { role: "user", text: prompt, user: user.label },
              { role: "assistant", text: "", user: "assistant" },
            ];
            //console.log("Sending newMsgArray", newMsgArray, prompt);
            // Lock task so users cannot send at same time. NodeJS will unlock on final response.
            modifyTask({ 
              "output.msgs": [...msgs, ...newMsgArray],
              "lock": true,
              "processor.command": "update",
            });
            setSubmittingForm(false);
          }
          break;
        case "receiving":
          if (transitionTo("receiving")) {
            setPrompt("");
          }
          const lastElement = { ...msgs[msgs.length - 1] }; // shallow copy
          // Avoid looping due to modifyTask by checking if the text has changed
          if (responseText && responseText !== lastElement.text) {
            lastElement.text = responseText;
            //console.log("modifyTask")
            modifyTask({
              "output.msgs": [...msgs.slice(0, -1), lastElement],
            });
          }
          break;
      }
      // Manage state.current and state.last
      modifyState(nextState);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, submittingForm, responseText]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (prompt) {
        setSubmittingForm(true);
      }
    },
    [prompt]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    textarea.placeholder = task?.config?.promptPlaceholder;
  }, [prompt, task?.config?.promptPlaceholder]);

  const handleDropdownSelect = (selectedPrompt) => {
    // Prepend to existing prompt, might be better just to replace
    setPrompt((prevPrompt) => selectedPrompt + prevPrompt );
    setSubmitForm(true);
  }

  // Allow programmatic submission of the form 
  // Set submitForm to true to submit
  // Maybe events would be better
  useEffect(() => {
    if (!submitForm) {
      const formNode = formRef.current;
      if (formNode) {
        formNode.requestSubmit();
      }
    }
  }, [submitForm]);

  const sendReady = (!task || task.state.current === "sending") ? "not-ready" : "ready"

  return (
    <form onSubmit={handleSubmit} ref={formRef} className="msg-form">
      {task && task.config?.suggestedPrompts ? (
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
          disabled={sendReady === "not-ready"}
          className={"send-button " + sendReady}
        >
          {/* The key stops React double loading the image */}
          <img
            key={send}
            src={send}
            className={"send-" + sendReady}
          />
        </button>
      </div>
    </form>
  );
};

export default withTask(TaskChat);
