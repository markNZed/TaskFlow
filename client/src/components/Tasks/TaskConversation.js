/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useRef, useState, useEffect } from 'react';
import { delta, withDebug, withTask } from '../../utils';

import useFetchStart from '../../hooks/useFetchStart';
import TaskChat from "./TaskChat"
import Icon from "./TaskConversation/Icon"

/*
Task Process

Task Steps
  
ToDo:
  
*/

const TaskConversation = (props) => {
  const [fetchStart, setFetchStart] = useState();
  const { fetchResponse: fetchResponseStart, fetched: fetchedStart } = useFetchStart(fetchStart);
  const [myTask, setMyTask] = useState();
  const { startTask, setStartTask } = props
  const chatContainer = useRef(null);
  const messagesEndRef = useRef(null)
  const hasScrolledRef = useRef(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const isMountedRef = useRef(false);
  const [msgs, setMsgs] = useState({});

  let welcomeMessage_default = "Bienvenue ! Comment puis-je vous aider aujourd'hui ?"

  //console.log("TaskConversation component")

  useEffect(() => {
    if (!myTask) {
      setFetchStart('root.ui.TaskConversation.start')
    }
  }, []);

  useEffect(() => {
    if (startTask) {
      if (startTask?.step === 'receiving' && msgs) {
        const lastElement = { ...msgs[startTask.threadId][msgs[startTask.threadId].length - 1]} // shallow copy
        lastElement.text = startTask.response;
        lastElement.isLoading = false 
        setMsgs((p) => ({
          ...p,
          [startTask.threadId]: [
            ...p[startTask.threadId].slice(0,-1), 
            lastElement
          ]
        }));
      } else if (startTask?.step === 'sending' && startTask.last_step !== 'sending') {
        // here we need to create a new slot for the next message
        // Note we need to add the input to for the user
        //console.log("Creating new entry for next chat", startTask)
        const newMsgArray = [
          { sender: 'user', text: startTask.client_prompt,  isLoading: false,}, 
          { sender: 'bot', 
            text: "", 
            isLoading: true, 
          }];
        setMsgs((p) => ({
            ...p,
            [startTask.threadId]: [
              ...p[startTask.threadId], 
              ...newMsgArray
            ]
          }));
        // This is replaced upon return of task from server
        //setStartTask((p) => {return { ...p, step : 'receiving' }});
      } else if (startTask?.step === 'input' && startTask.last_step !== 'input') {
        const lastElement = { ...msgs[startTask.threadId][msgs[startTask.threadId].length - 1]} // shallow copy
        lastElement.text = startTask.response;
        lastElement.isLoading = false 
        setMsgs((p) => ({
          ...p,
          [startTask.threadId]: [
            ...p[startTask.threadId].slice(0,-1), 
            lastElement
          ]
        }));
      } else if (startTask?.step === 'input') {
        //console.log("Step input")
      }
    }
  }, [startTask, setStartTask]);

  useEffect(() => {
    if (fetchResponseStart) {
      setMyTask(fetchResponseStart)
    }
  }, [fetchResponseStart]);

  // Intercept updates to the startTask
  // Can detect when input is being sent and update UI ?
  // Could avoid Msgs passing ?
  function interceptSetStartTask(args) {
    setStartTask(args)
  }

  useEffect(() => {
    if (startTask) {
      let welcomeMessage = startTask?.welcome_message || welcomeMessage_default
      if (!isMountedRef.current) {
        setMsgs(
          {
            [startTask.threadId] : [
              { sender: 'bot', text: welcomeMessage,  isLoading: true}
            ]
          }
        );
        setTimeout(()=>{
            setMsgs(
              {
                [startTask.threadId] : [
                  { sender: 'bot', text: welcomeMessage,  isLoading: false}
                ]
              }
            );
        }, 1000);
        isMountedRef.current = true
      } else if ( !(startTask.threadId in msgs) ) {
        // Why do we need this? Should use (p) => style
        //console.log("HERE " + startTask.threadId + " ", msgs)
        setMsgs({
          ...msgs,
          [startTask.threadId]: [
            { sender: 'bot', text: welcomeMessage, isLoading: false }
          ],
        });
        //console.log("HERE2 ", msgs)
      }
    }
  }, [msgs, startTask]);

  useEffect(() => {
    if (isMountedRef.current) {
      if (messagesEndRef.current && !hasScrolledRef.current && !hasScrolled) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        hasScrolledRef.current = true;
      } else {
        hasScrolledRef.current = false;
      }
    }
  }, [msgs, hasScrolled]);

  const handleScroll = () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 20 ) {
      setHasScrolled(false);
    } else {
      setHasScrolled(true);
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  },[]);

  return (
    <section className='chatbox'>
      <div id="chat-container" ref={chatContainer} >
        {startTask && msgs[startTask.threadId] && msgs[startTask.threadId].map((msg, index) => {
          return (
            <div key={index} className={`wrapper ${msg.sender === 'bot' && 'ai'}`}>
              <div className="chat"> 
                <Icon sender={msg.sender}/>
                {msg.isLoading ? 
                  <div key={index} className="dot-typing"></div> : 
                  <div className="message">{msg.text}</div>
                }
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} style={{height:"5px"}}/>
      </div>
      <TaskChat task={startTask} setTask={interceptSetStartTask} parentTask={myTask} />
    </section> 
  )

}

export default React.memo(withTask(withDebug(TaskConversation)))