/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from 'react'
import PromptDropdown from './TaskChat/PromptDropdown'
import { delta } from '../../utils/utils'
import withDebug from '../../utils/withDebug'
import withTask from '../../utils/withTask'

// assets
import send from '../../assets/send.svg';

/*
Task Process
  Present textarea and dropdown for user to enter a prompt
  When prompt is submitted send the task to server step=sending
  Server sends incemental text responses by websocket updating task.response
  Server sends final text and terminates HTTP request with step=input
  Parent component is expected to:
    Display updates to task.response while step=input
    Detect step=sending and display/store user's prompt and set step=receiving ** should not be setting step in parent?
  If server request returns (!taskLoading) and step=receiving the websocket did not start/finish
    Update with the HTTP response so step=input

Task Steps
  input: get user prompt
  sending: sending user prmopt to server
  receiving: receiving websocket response from server
  
ToDo:
  Allow copy/paste while updating
    To allow this we need to append dom elements. 
    In chatGPT they have the same problem inside the active <p> 
    but once rendered hte <p></p> can be copied
  Macros ?
*/

const TaskChat = (props) => {

  const { log, webSocketEventEmitter, updateTask, updateStep, taskLoading, task, setTask } = props

  const [prompt, setPrompt] = useState("");
  const [responsePending, setResponsePending] = useState(false);
  const textareaRef = useRef(null);
  const formRef = useRef(null);

  // When task.update is set true then it will send task to the server and update

  function updateResponse(mode, text) {
    switch (mode) {
        case 'delta':
          // Don't use updateTask because we want to append to a property in the task
          setTask(p => ({ ...p, response: p.response + text}));
          break;
        case 'partial':
          updateTask({ response: text })
          break;
        case 'final':
          // So observers of the task know we finished
          updateTask({ response: text })
          break;
      }
      // Indicates the response has started
      setResponsePending(false);
  }

  useEffect(() => {
    if (!webSocketEventEmitter) {return}
    const handleMessage = (e) => {
      const j = JSON.parse(e.data)
      if (task?.instanceId && j?.instanceId === task.instanceId) {
        if (j?.mode && j?.text) {
          updateResponse(j.mode, j.text)
        }
      }
    };
    webSocketEventEmitter.on('message', handleMessage);
    return () => {
      webSocketEventEmitter.removeListener('message', handleMessage);
    };
  }, [webSocketEventEmitter]);

  // The websocket should make updates but if that has failed we fall back to the HTTP response
  useEffect(() => {
    if (taskLoading) {
      if (task.step === 'sending') {
        // Start receiving
        updateStep('receiving')
      }
    } else if (task?.step === 'receiving') {
      // Finished receiving
      updateResponse('final', task.response)
      delta(() => {updateStep('input')})
    }
  }, [taskLoading]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault(); 
    if (!prompt){ return }
    setResponsePending(true);
    // Set update to send to server
    updateTask({ client_prompt: prompt, update: true, response: '' });
    updateStep('sending')
    // Clear the textbox
    setPrompt("");
  },[prompt, setPrompt]);

  useEffect(() => {
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    textarea.placeholder="Écrivez votre prompt ici.";
  }, [prompt]);

  const handleDropdownSelect = (selectedPrompt) => {
    // Append to existing prompt text, might be better just to replace
    setPrompt((prevPrompt) => prevPrompt + selectedPrompt);
    // Submit the form
    const formNode = formRef.current;
    if (formNode) {
      // Wait for the setPrompt to take effect
      delta(() => {formNode.requestSubmit()})
    }
  };

  return (
    <form onSubmit={handleSubmit} ref={formRef} className="msg-form">
        {task?.suggested_prompts ?
          <div style={{textAlign: 'left'}}>
            <PromptDropdown 
              prompts={task?.suggested_prompts} 
              onSelect={handleDropdownSelect} 
            />
          </div>
          : 
          ''
        }
        <div className="msg-textarea-button">
          <textarea
            ref={textareaRef} 
            name="prompt"
            value={prompt}
            rows="1"
            cols="1"
            onChange={(e) => {
              setPrompt(e.target.value);
            } }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey === false) {
                e.preventDefault();
                handleSubmit(e);
              }
            } }
          />
          <button type="submit" disabled={responsePending} className={responsePending ? "send-button not-ready" : "send-button ready"}>
            {/* The key stops React double loading the image when both img and message are updated */}
            <img key={send} src={send} alt="Send" className={responsePending ? "send-not-ready" : "send-ready"} />
          </button>
        </div>
    </form>
  );
}

// withDebug expects to be the first HOC wrapping the component
export default React.memo(withTask(withDebug(TaskChat)));