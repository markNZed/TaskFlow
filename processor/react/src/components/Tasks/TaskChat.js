/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";
import { utils } from "../../utils/utils";
import PromptDropdown from "./TaskChat/PromptDropdown";
import send from "../../assets/send.svg";
import { v4 as uuidv4 } from "uuid";

/*
Task Process
  Present textarea and dropdown for user to enter a prompt
  When prompt is submitted state.current -> send
  NodeJS sends incemental text responses by websocket updating task.output.LLMResponse
  NodeJS sends final text and terminates HTTP request with state.current=received
  Parent component is expected to:
    Display updates to task.output.msgs
    Provide task.input.msgs

Task States
  start:
  input: detect submission of input or skip to state mentionAddress
  mentionAddress: send location as prompt
  sending: sending user prmopt to NodeJS Task Processor
  receiving: receiving websocket response from NodeJS Task Processor
  received: 

Task IO
  request:
  response:
  output:
    LLMResponse: output from the LLM
    msgs: input.msgs with prompt appended
    sending: indicate prompt is being sent to LLM
  input:
    prompt: the prompt input 
    submitPrompt: trigger to send prompt
    msgs: conversation history 
  
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
    modifyTask,
    transition,
    transitionTo, 
    transitionFrom, 
    user,
    onDidMount,
    componentName,
    isLocked,
  } = props;

  const [submitPrompt, setSubmitPrompt] = useState(false);
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
        //console.log("prevResponses.length", prevResponses.length);
        for (const response of prevResponses) {
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
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log("TaskChat State Machine State " + task.state.current,task) }
    const msgs = task.input?.msgs || [];
    //console.log("msgs before SM", msgs);
    switch (task.state.current) {
      case "start":
        modifyTask({
          "output.sending": false,
          "input.promptText": "",
          "input.submitPrompt": false,
        });
        nextState = "input";
      case "input":
        if (transitionFrom("received")) {
          responseTextRef.current = "";
          setResponseText(responseTextRef.current);
        }
        if (task.input.submitPrompt) {
          nextState = "send";
        }
        if (task.state?.address && task.state?.lastAddress !== task.state.address) {
          nextState = "mentionAddress";
        }
        break;
      case "mentionAddress":
        if (transitionTo("mentionAddress") && !isLocked) {
          // Add the input too for the user
          const promptText = "Location: " + task.state?.address;
          // Lock task so users cannot send at same time. NodeJS will unlock on final response.
          modifyTask({ 
            "output.LLMResponse": { role: "assistant", text: "", user: "assistant", id: uuidv4() },
            "output.sending": true,
            "output.msgs": [...msgs, { role: "user", text: promptText, user: user.label, id: uuidv4() }],
            "request.prompt": promptText,
            "state.lastAddress": task.state.address,
            "commandArgs": { "lock": true },
            "command": "update",
          });
        }
        break;
      case "send":
        if (transitionTo("send") && !isLocked) {
          // Lock task so users cannot send at same time. NodeJS will unlock on final response.
          modifyTask({ 
            "output.LLMResponse": {role: "assistant", text: "", user: "assistant", id: uuidv4()},
            "output.sending": true,
            "output.msgs": [...msgs, {role: "user", text: task.input.promptText, user: user.label, id: uuidv4()}],
            "input.promptText": "",
            "input.submitPrompt": false,
            "request.prompt": task.input.promptText,
            "commandArgs": { "lock": true },
            "command": "update",
          });
        }
        break;
      case "receiving":
        // Avoid looping due to modifyTask by checking if the text has changed
        if (responseText && responseText !== task.output.LLMResponse?.text) {
          modifyTask({
            "output.LLMResponse.text": responseText,
          });
        }
        break;
      case "received":
        if (!isLocked) {
          // If we set nextState at the same time as command then there is a risk that the 
          // task.state.current updates before the command is sent.
          // By setting nextState after the transition we minimize this risk.
          // We probably need to be able to await on modifyTask so we know command has been sent
          // Could also chain the nextState assignment. This turns out to be difficult in React.
          // So instead of setting nextState we set the state in modifyTask
          if (transition()) {
            // Need to update to store output.msgs
            let outputPromptResponse = task.output.LLMResponse;
            outputPromptResponse.text = task.response.LLMResponse;
            modifyTask({
              "output.LLMResponse": null,
              // If we use msgs instead of task.output.msgs then we can miss the last user prompt
              // It can take time for the output that includes the user prompt to go to
              // TaskConversation and come back as task.input
              // Here we simply append to the current output so avoiding that issue
              "output.msgs": [ ...task.output.msgs, outputPromptResponse ],
              "commandArgs": { "unlock": true },
              "command": "update",
              "state.current": "input",
            });
            //nextState = "input";
          }
        }
        break;
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, responseText]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (task?.input?.promptText) {
        modifyTask({
          "input.submitPrompt": true,
        });
      }
    },
    [task?.input?.promptText]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    textarea.placeholder = task?.config?.local?.promptPlaceholder;
  }, [task?.input?.promptText, task?.config?.local?.promptPlaceholder]);

  const handleDropdownSelect = (selectedPrompt) => {
    // Prepend to existing prompt, might be better just to replace
    modifyTask({"input.promptText": selectedPrompt + task.input.promptText});
    setSubmitPrompt(true);
  }

  // Allow programmatic submission of the form 
  // Set submitPrompt to true to submit
  // Maybe events would be better
  useEffect(() => {
    if (submitPrompt) {
      const formNode = formRef.current;
      if (formNode) {
        formNode.requestSubmit();
      }
    }
  }, [submitPrompt]);

  function processMessages(text) {
    if (text) {
      const regexProcessMessages = task.config?.local?.regexProcessMessages;
      if (regexProcessMessages) {
        for (const [regexStr, replacement] of regexProcessMessages) {
          let { pattern, flags } = utils.parseRegexString(regexStr);
          const regex = new RegExp(pattern, flags);
          text = text.replace(regex, replacement);
        }
      }
    }
    return text;
  }

  const sendReady = (!task || task.state.current === "sending") ? "not-ready" : "ready"

  return (
    <form onSubmit={handleSubmit} ref={formRef} className="msg-form">
      {task && task.config?.local?.suggestedPrompts ? (
        <div style={{ textAlign: "left" }}>
          <PromptDropdown
            prompts={task.config.local.suggestedPrompts}
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
          value={processMessages(task.input?.promptText)}
          rows="1"
          cols="1"
          onChange={(e) => {
            modifyTask({"input.promptText": e.target.value});
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
