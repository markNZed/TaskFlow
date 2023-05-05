/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import { delta, deepMerge } from "../../utils/utils";
import withTask from "../../hoc/withTask";

import PromptDropdown from "./TaskChat/PromptDropdown";

// assets
import send from "../../assets/send.svg";

/*
Task Process
  Present textarea and dropdown for user to enter a prompt
  When prompt is submitted send the task to nodejsProcessor with state.current=sending
  Server sends incemental text responses by websocket updating task.response.text
  Server sends final text and terminates HTTP request with state.current=input
  Parent component is expected to:
    Display updates to task.response.text while state.current=input
    Detect state.current=sending and display/store user's prompt and set state.current=receiving ** should not be setting step in parent?
  If nodejsProcessor request returns (!updateTaskLoading) and state.current=receiving the websocket did not start/finish
    Update with the HTTP response so step=input

Task States
  input: get user prompt
  sending: sending user prmopt to nodejsProcessor
  receiving: receiving websocket response from nodejsProcessor
  
ToDo:
  Allow copy/paste while updating
    To allow this we need to append dom elements. 
    In chatGPT they have the same problem inside the active <p> 
    but once rendered hte <p></p> can be copied
  Should updateTaskLoading be part of the task object?
*/

const TaskChat = (props) => {
  const {
    log,
    useTaskWebSocket,
    updateTask,
    updateStep,
    updateTaskLoading,
    task,
    setTask,
    component_depth,
  } = props;

  const [prompt, setPrompt] = useState("");
  const [responsePending, setResponsePending] = useState(false);
  const textareaRef = useRef(null);
  const formRef = useRef(null);

  // This is the level where we are going to use the task so set the component_depth
  useEffect(() => {
    updateTask({ stackPtr: component_depth });
  }, []);

  function updateResponse(mode, text) {
    switch (mode) {
      case "delta":
        // There are issues when calling setTask: TaskConversation does not see the change
        // I guess because setTask is passed down from Taskflows.js
        // Maybe need to or maybe wrap setTask in withTask
        // It makes the change but does not trigger so why does updateTask ?
        // It seems it does not see updates to p.response.text
        // This does work. 
        setTask((p) =>
          deepMerge(
            p,
            {response: { text : p.response.text + text}}
          )
        );
        
        //updateTask({ "response.text": (task.response.text ? task.response.text + text : text) });
        break;
      case "partial":
        updateTask({ "response.text": text });
        break;
      case "final":
        // So observers of the task know we finished
        updateTask({ "response.text": text });
        break;
    }
    // Indicates the response has started
    setResponsePending(false);
  }

  useTaskWebSocket((partialTask) => {
    if (partialTask?.response) {
      if (partialTask.response?.mode && partialTask.response?.text) {
        updateResponse(partialTask.response.mode, partialTask.response.text);
      }
    }
  });

  // The websocket returns the response but if that fails we use the HTTP response here
  useEffect(() => {
    if (!task) {
      return;
    }
    if (updateTaskLoading) {
      // Should this be part of the task object
      if (task.state.current === "sending") {
        // Start receiving
        updateStep("receiving");
      }
    } else if (task.state.current === "receiving") {
      // The response also returns the compete text, which may already be updated by websocket.
      updateResponse("final", task.response.text);
    }
  }, [updateTaskLoading]);

  useEffect(() => {
    if (
      task &&
      task.state.current === "input" &&
      task.state.deltaState !== "input"
    ) {
      // The nodejsProcessor set the state to input so we set deltaState
      // Could look after this in useUpdateTask
      // Reset the request so we can use response.text for partial response
      updateTask({
        "request.input": "",
        "response.text": "",
        "state.deltaState": "input",
      });
    }
  }, [task]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!prompt) {
        return;
      }
      setResponsePending(true);
      // Set update to send to nodejsProcessor
      updateStep("sending");
      updateTask({ "request.input": prompt, send: true });
      //updateTask({ client_prompt: prompt, update: true, response: '' });
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
            alt="Send"
            className={responsePending ? "send-not-ready" : "send-ready"}
          />
        </button>
      </div>
    </form>
  );
};

export default React.memo(withTask(TaskChat));
