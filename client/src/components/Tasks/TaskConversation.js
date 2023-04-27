/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useRef, useState, useEffect } from 'react';
import withTask from '../../hoc/withTask';

import DynamicComponent from "./../Generic/DynamicComponent";
import Icon from "./TaskConversation/Icon"

/*
Task Process
  Present a conversation
  Launch a chat task that collects messages from human and bot
  Currently this task does very little, in theory it could manage the conversation history
  task has single component so we create that and pass down

  Maybe pass the taskId into the component and then it looks after it
  How does the chatTask communicate with Conversation ? 

Task Steps
  
ToDo:
  // 
*/

const TaskConversation = (props) => {

  const { 
    task, 
    setTask, 
    startTaskLoading,
    startTaskError,
    startTask,
    startTaskFn,
    component_depth,
    useTaskState,
  } = props

  const [myTask, setMyTask] = useState();
  const [childTask, setChildTask] = useState();
  
  const chatContainer = useRef(null);
  const messagesEndRef = useRef(null)
  const hasScrolledRef = useRef(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const isMountedRef = useRef(false);
  const [msgs, setMsgs] = useState({});

  let welcomeMessage_default = "Bienvenue ! Comment puis-je vous aider aujourd'hui ?"

  useEffect(() => {
    startTaskFn(task.id, task.threadId, component_depth + 1)
  }, []);

  useEffect(() => {
    if (startTask) {
      setChildTask(startTask)
    }
  }, [startTask]);


  /*
  useEffect(() => {
    if (fetchResponseStart) {
      setChildTask(fetchResponseStart)
    }
  }, [fetchResponseStart]);
  */

  /*
  // Upon loading this component fetches its own Task and passes the props.task on to the chat
  useEffect(() => {
    if (!myTask) {
      setFetchStart('root.components.TaskConversation.start')
    }
  }, []);

  useEffect(() => {
    if (fetchResponseStart) {
      setMyTask(fetchResponseStart)
    }
  }, [fetchResponseStart]);
  */

  useEffect(() => {
    if (childTask) {
      if (childTask?.step === 'receiving' && msgs) {
        const lastElement = { ...msgs[task.threadId][msgs[task.threadId].length - 1]} // shallow copy
        lastElement.text = childTask.response;
        lastElement.isLoading = false 
        setMsgs((p) => ({
          ...p,
          [task.threadId]: [
            ...p[task.threadId].slice(0,-1), 
            lastElement
          ]
        }));
      } else if (childTask?.step === 'sending' && childTask.last_step !== 'sending') {
        // here we need to create a new slot for the next message
        // Note we need to add the input to for the user
        //console.log("Creating new entry for next chat", task)
        const newMsgArray = [
          { sender: 'user', text: childTask.client_prompt,  isLoading: false,}, 
          { sender: 'bot', 
            text: "", 
            isLoading: true, 
          }];
        setMsgs((p) => ({
            ...p,
            [task.threadId]: [
              ...p[task.threadId], 
              ...newMsgArray
            ]
          }));
      } else if (childTask?.step === 'input' && childTask.last_step !== 'input') {
        const lastElement = { ...msgs[task.threadId][msgs[task.threadId].length - 1]} // shallow copy
        lastElement.text = childTask.response;
        lastElement.isLoading = false 
        setMsgs((p) => ({
          ...p,
          [task.threadId]: [
            ...p[task.threadId].slice(0,-1), 
            lastElement
          ]
        }));
      } else if (task?.step === 'input') {
        //console.log("Step input")
      }
    }
  }, [childTask]);

  useEffect(() => {
    if (task) {
      let welcomeMessage = task?.welcome_message || welcomeMessage_default
      if (!isMountedRef.current) {
        setMsgs(
          {
            [task.threadId] : [
              { sender: 'bot', text: welcomeMessage,  isLoading: true}
            ]
          }
        );
        setTimeout(()=>{
            setMsgs(
              {
                [task.threadId] : [
                  { sender: 'bot', text: welcomeMessage,  isLoading: false}
                ]
              }
            );
        }, 1000);
        isMountedRef.current = true
      } else if ( !(task.threadId in msgs) ) {
        // Why do we need this? Should use (p) => style
        setMsgs({
          ...msgs,
          [task.threadId]: [
            { sender: 'bot', text: welcomeMessage, isLoading: false }
          ],
        });
        //console.log("HERE2 ", msgs)
      }
    }
  }, [msgs, task]);

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

  // Tracing
  useEffect(() => {
    //console.log("Tracing childTask ", childTask)
  }, [childTask]); 

  return (
    <section className='chatbox'>
      <div id="chat-container" ref={chatContainer} >
        {task && msgs[task.threadId] && msgs[task.threadId].map((msg, index) => {
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
      { childTask && (  
        <DynamicComponent is={childTask.component[component_depth]} task={childTask} setTask={setChildTask} parentTask={myTask} component_depth={props.component_depth}/>
      )}
      { /* <TaskChat task={childTask} setTask={setChildTask} parentTask={myTask} /> */ }
    </section> 
  )

}

export default React.memo(withTask(TaskConversation))