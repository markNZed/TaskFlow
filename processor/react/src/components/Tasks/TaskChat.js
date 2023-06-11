/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";
import useGlobalStateContext from "../../contexts/GlobalStateContext";
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
    modifyTask,
    modifyState,
    task,
    processorId,
  } = props;

  const [prompt, setPrompt] = useState("");
  const [myLastState, setMyLastState] = useState("");
  const [submitForm, setSubmitForm] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [responseText, setResponseText] = useState("");
  const responseTextRef = useRef("");
  const textareaRef = useRef();
  const formRef = useRef();
  const [socketResponses, setSocketResponses] = useState([]);
  const { globalState } = useGlobalStateContext();

  // Note that socketResponses may not (will not) be updated on every websocket event
  // React groups setState operations and I have not understood the exact criteria for this
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
            case 'final':
              responseTextRef.current = text;
              break;
          }
          //console.log("TaskChat processResponses responseTextRef.current:", responseTextRef.current);
        }
        setResponseText(responseTextRef.current);
        modifyTask({ "response.text": responseTextRef.current });
        return []; // Clear the processed socketResponses
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
      //console.log("TaskChat usePartialWSFilter partialTask", partialTask.response);
      setSocketResponses((prevResponses) => [...prevResponses, partialTask.response]);
    }
  )

  function transitionTo(state) {
      return (task.state.current === state && myLastState !== state)
  }

  function transitionFrom(state) {
    return (task.state.current !== state && myLastState === state)
  }

  function transition() {
    return (task.state.current !== myLastState)
  }

  // Task state machine
  // Need to be careful setting task in the state machine so it does not loop
  // Could add a check for this
  useEffect(() => {
    if (task) {
      let nextState;
      if (transition()) { log("TaskChat State Machine State " + task.state.current) }
      const msgs = JSON.parse(JSON.stringify(task.output.msgs)); // deep copy
      if (task.state.current === "receiving") {
        const lastElement = { ...msgs[msgs.length - 1] }; // shallow copy
        // Avoid looping dur to modifyTask by checking if the text has changed
        if (responseText && responseText !== lastElement.text) {
          lastElement.text = responseText;
          modifyTask({ "output.msgs": [...msgs.slice(0, -1), lastElement],
            "state.isLoading": false
          });
        }
      // Detect change to sending and create a slot for new msgs
      } else if (transitionTo("sending")) {
        // Should be named delta not deltaState (this ensures we see the event once)
        // Create a new slot for the next message
        // Add the input too for the user
        const newMsgArray = [
          { role: "user", text: prompt, user: globalState.user.label },
          { role: "assistant", text: "", user: "assistant" },
        ];
        //console.log("Sending newMsgArray", newMsgArray, prompt);
        // Lock so users cannot send at same time. NodeJS will unlock on final response.
        modifyTask({ 
          "output.msgs": [...msgs, ...newMsgArray],
          "state.isLoading": true,
          "lock": true,
          update: true
        });
        setSubmittingForm(false);
        setPrompt("");
      } else if (transitionTo("input") && transitionFrom("receiving")) {
        responseTextRef.current = "";
      } else if (task.state.current === "input") {
        if (submittingForm) {
          nextState = "sending";
        }
      }
      if (task.state.current !== nextState) {
        if (nextState) {
          modifyState(nextState);
        }
        // Used by transitionTo && transitionFrom
        setMyLastState(task.state.current);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, submittingForm, responseText]);

  /*
  useEffect(() => {
    if (task) {
      console.log("------------------------------------------------")
      console.log("TRACE task?.state.current ", task?.state.current, task)
    }
  }, [task?.state.current]);
  */

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (prompt) {
        setSubmittingForm(true);
      }
    },
    [prompt, setPrompt]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    textarea.placeholder = task?.config?.promptPlaceholder;
  }, [prompt]);

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

  const sendReady = task.state.current === "sending" ? "not-ready" : "ready"

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
