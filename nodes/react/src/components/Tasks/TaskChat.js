/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import usePartialWSFilter from "../../hooks/usePartialWSFilter";
import { utils } from "../../utils/utils.mjs";
import PromptDropdown from "./TaskChat/PromptDropdown";
import send from "../../assets/send.svg";
import { v4 as uuidv4 } from "uuid";

/*
Task Function
  Present textarea and dropdown for user to enter a prompt
  When prompt is submitted state.current -> send
  RxJS Processor sends incemental text responses by websocket updating task.output.LLMResponse
  RxJS Processor sends final text with state.current=received
  Parent component is expected to:
    Display updates to task.output.msgs
    Provide task.input.msgs

Task States
  start:
  input: detect submission of input or skip to state mentionAddress
  mentionAddress: send location as prompt
  sending: sending user prompt to RxJS Processor
  receiving: receiving websocket response from RxJS Processor
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
    componentName,
    checkLocked,
  } = props;

  const [submitPrompt, setSubmitPrompt] = useState(false);
  const [responseText, setResponseText] = useState("");
  const responseFinal = useRef(true);
  const responseTextRef = useRef("");
  const textareaRef = useRef();
  const formRef = useRef();
  const [socketResponses, setSocketResponses] = useState([]);
  const maxHistorySize = 100; 
  const [chatHistory, setChatHistory] = useState(() => {
    const loadedHistory = JSON.parse(localStorage.getItem('chatHistory' + task.id) || '[]');
    return loadedHistory.slice(-maxHistorySize);
  });
  const historyIndexRef = useRef(0);
  const partialInputRef = useRef("");

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  useEffect(() => {
    const trimmedHistory = chatHistory.slice(-maxHistorySize);
    localStorage.setItem('chatHistory' + task.id, JSON.stringify(trimmedHistory));
  }, [chatHistory]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndexRef.current < chatHistory.length) {
          // Save the current partial input before going to the history
          historyIndexRef.current++;
          modifyTask({"input.promptText": chatHistory[chatHistory.length - historyIndexRef.current]});
        }
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          modifyTask({"input.promptText": chatHistory[chatHistory.length - historyIndexRef.current]});
        } else {
          // Restore the partial input if we're back at the latest message
          modifyTask({"input.promptText": partialInputRef.current});
        }
      }
    };
  
    window.addEventListener('keydown', handleKeyDown);
  
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chatHistory]);

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
              if (responseFinal.current) {
                responseTextRef.current = text;
                responseFinal.current = false;
              } else {
                responseTextRef.current += text;
              }
              break;
            case 'partial':
              responseTextRef.current = text;
              break;
            case 'final':
              responseTextRef.current = text;
              responseFinal.current = true; // So we can reset between messages
              break;
            default:
              console.error("Unknown mode " + mode);
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

  function describe(text) {
    // Because this is updating a React state it may not be immediately available upon return.
    // An advantage of htis is that the description is not in the task object so visible on other nodes
    modifyTask({
      "state.description": {[task.state.current]: text}
    });
  }

  // Task state machine
  // Need to be careful setting task in the state machine so it does not loop
  // Could add a check for this
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log("TaskChat State Machine State " + task.state.current) }
    const msgs = task.input?.msgs || [];
    //console.log("msgs before SM", msgs);
    switch (task.state.current) {
      case "start": {
        describe("Demo of describing a state");
        modifyTask({
          "output.sending": false,
          "input.promptText": "",
          "input.submitPrompt": false,
        });
        nextState = "input";
        break;
      }
      case "input": {
        if (transitionFrom("received")) {
          responseTextRef.current = "";
          setResponseText(responseTextRef.current);
        }
        if (task.input && task.input.submitPrompt) {
          nextState = "send";
        }
        if (task.state?.address && task.state?.lastAddress !== task.state.address) {
          nextState = "mentionAddress";
        }
        break;
      }
      case "mentionAddress":
        if (transitionTo("mentionAddress") && !checkLocked()) {
          // Add the input too for the user
          const promptText = "Location: " + task.state?.address;
          // Lock task so users cannot send at same time. RxJS Processor Consumer will unlock on final response.
          modifyTask({ 
            "output.LLMResponse": { role: "assistant", content: "", user: "assistant", id: uuidv4() },
            "output.sending": true,
            "output.msgs": [...msgs, { role: "user", content: promptText, user: user.label, id: uuidv4() }],
            "request.prompt": promptText,
            "state.lastAddress": task.state.address,
            "commandArgs": { "lock": true },
            "command": "update",
            "commandDescription": "Send user location as a prompt",
          });
        }
        break;
      case "send":
        if (transitionTo("send") && !checkLocked()) {
          // Lock task so users cannot send at same time. RxJS Processor Consumer will unlock on final response.
          modifyTask({ 
            "output.LLMResponse": {role: "assistant", content: "", user: "assistant", id: uuidv4()},
            "output.sending": true,
            "output.msgs": [...msgs, {role: "user", content: task.input.promptText, user: user.label, id: uuidv4()}],
            "input.promptText": "",
            "input.submitPrompt": false,
            "request.prompt": task.input.promptText,
            "commandArgs": { "lock": true },
            "command": "update",
            "commandDescription": "Send user prompt",
          });
          setChatHistory(prevChatHistory => {
            const newChatHistory = [...prevChatHistory, task.input.promptText];
            // trim the history array if it exceeds the limit
            return newChatHistory.slice(-maxHistorySize);
          });
        }
        break;
      case "configFunctionRequest":
      case "configFunctionResponse":
      case "receiving":
        // Avoid looping due to modifyTask by checking if the content has changed
        if (responseText && responseText !== task.output.LLMResponse?.content) {
          modifyTask({
            "output.LLMResponse.content": responseText,
          });
        }
        break;
      case "received":
        if (!checkLocked()) {
          // If we set nextState at the same time as command then there is a risk that the 
          // task.state.current updates before the command is sent.
          // We probably need to be able to await on modifyTask so we know command has been sent
          // Could also chain the nextState assignment. This turns out to be difficult in React.
          // So instead of setting nextState we set the state in modifyTask
          if (transition()) {
            // Need to update to store output.msgs
            let outputPromptResponse = task.output.LLMResponse;
            outputPromptResponse.content = task.response.LLMResponse;
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
              "commandDescription": "Update output.msgs with latest output.LLMResponse and clear output.LLMResponse",
            });
          }
        }
        break;
      default:
        break;
    }
    // Manage state.current
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
            partialInputRef.current = e.target.value;
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
            alt="send"
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
