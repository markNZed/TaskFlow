/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useRef, useState, useEffect } from "react";
import withTask from "../../hoc/withTask";
import { deepCompare, replaceNewlinesWithParagraphs } from "../../utils/utils";
import DynamicComponent from "./../Generic/DynamicComponent";
import Icon from "./TaskConversation/Icon";

/*
Task Process
  Present a conversation
  Launch a chat task that collects messages from human and bot
  Currently this TaskConversation does very little, in theory it could manage the conversation history
  The Task is passed on to the TaskChat component
  
ToDo:
  startTaskFn could return the task ?
*/

const TaskConversation = (props) => {
  const {
    task,
    setTask,
    childTask,
    setChildTask,
    startTaskError,
    startTask,
    startTaskFn,
    stackPtr,
    useTaskState,
    onDidMount,
  } = props;

  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasScrolledRef = useRef(false);
  const chatInputRef = useRef(null);
  const [chatContainermaxHeight, setChatContainermaxHeight] = useState();
  const [hasScrolled, setHasScrolled] = useState(false);
  const isMountedRef = useRef(false);
  const [msgs, setMsgs] = useState([]);

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  /*
  useEffect(() => {
    let startTaskId = task.id
    if (task.stackTaskId.length > 0) {
      startTaskId = task.stackTaskId[stackPtr]
    }
    startTaskFn(startTaskId, task.threadId, stackPtr + 1);
  }, []);

  useEffect(() => {
    if (startTask) {
      setChatTask(startTask);
    }
  }, [startTask]);
  */

  // Either we use the task we received or we pass it down and start a task for this stackPtr level

  useEffect(() => {
    if (childTask) {
      const taskMessages = childTask.output?.msgs || [];
      // The welcome message is not included as part of the Task msgs sent to the LLM
      if (childTask.config?.welcomeMessage && childTask.config?.welcomeMessage !== "") {
        const welcomeMessage = { role: "assistant", text: childTask.config?.welcomeMessage, user: "assistant" };
        //console.log("setMsgs", [welcomeMessage, ...taskMessages]);
        setMsgs([welcomeMessage, ...taskMessages]);
      } else {
        setMsgs(taskMessages);
      }
    }
  }, [childTask?.output?.msgs]);

  useEffect(() => {
    //console.log("childTask",childTask)
  }, [childTask]);

  useEffect(() => {
    if (isMountedRef.current) {
      if (messagesEndRef.current && !hasScrolledRef.current && !hasScrolled) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        hasScrolledRef.current = true;
      } else {
        hasScrolledRef.current = false;
      }
    }
  }, [msgs, hasScrolled]);

  const handleScroll = () => {
    const chatContainer = chatContainerRef.current;
    if (
      chatContainer.clientHeight + chatContainer.scrollTop >=
    chatContainer.scrollHeight - 50
    ) {
      setHasScrolled(false);
    } else {
      setHasScrolled(true);
    }
  };

  useEffect(() => {
    const chatContainerRect = chatContainerRef.current.getBoundingClientRect();
    const chatInputRect = chatInputRef.current.getBoundingClientRect();
    const maxHeight = Math.max(chatInputRect.top - chatContainerRect.top, 100)
    setChatContainermaxHeight(maxHeight)
  }, [chatContainerRef, chatInputRef]); // chatInputRef detects mobile screen rotation changes

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    chatContainer.addEventListener("scroll", handleScroll);
    return () => {
      chatContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <section className="chat-section">
      <div 
        id="chat-container" 
        ref={chatContainerRef}
        style={{
          maxHeight: `${chatContainermaxHeight}px`,
        }}
      >
        { msgs && msgs.length > 0 &&
          msgs.map((msg, index) => {
            const isLastElement = index === msgs.length - 1;
            return (
              <div
                key={index}
                className={`wrapper ${msg.role === "assistant" && "ai"}`}
              >
                <div className="chat">
                  <Icon role={msg.role} user={msg.user} />
                  {childTask.state.current === "sending" && isLastElement ? (
                    <div key={index} className="dot-typing"></div>
                  ) : (
                    <div 
                      className="message text2html"
                      dangerouslySetInnerHTML={{ __html: replaceNewlinesWithParagraphs(msg.text) }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        <div ref={messagesEndRef} style={{ height: "5px" }} />
      </div>
      <div id="chat-input" ref={chatInputRef}>
        {childTask && (
          <DynamicComponent
            key={childTask.id}
            is={childTask.stack[stackPtr]}
            task={childTask}
            setTask={setChildTask}
            parentTask={task}
            stackPtr={stackPtr}
            stackTaskId={props.stackTaskId}
          />
        )}
      </div>
    </section>
  );
};

export default withTask(TaskConversation);
