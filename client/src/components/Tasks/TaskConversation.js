/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useRef, useState, useEffect } from "react";
import withTask from "../../hoc/withTask";

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
    startTaskLoading,
    startTaskError,
    startTask,
    startTaskFn,
    component_depth,
    useTaskState,
  } = props;

  const chatContainer = useRef(null);
  const messagesEndRef = useRef(null);
  const hasScrolledRef = useRef(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const isMountedRef = useRef(false);
  const [msgs, setMsgs] = useState({});
  const [conversationTask, setConversationTask] = useTaskState(
    null,
    "conversationTask"
  );

  let welcomeMessage_default =
    "Bienvenue ! Comment puis-je vous aider aujourd'hui ?";

  // We are not using this but potentially it is the task that
  // manages a meta-level related to the conversation
  useEffect(() => {
    startTaskFn(task.id, task.threadId, component_depth);
  }, []);

  useEffect(() => {
    if (startTask) {
      setConversationTask(startTask);
    }
  }, [startTask]);

  useEffect(() => {
    if (task) {
      // Update msgs
      if (task.state.current === "receiving" && msgs) {
        const lastElement = {
          ...msgs[task.threadId][msgs[task.threadId].length - 1],
        }; // shallow copy
        lastElement.text = task.response.text;
        lastElement.isLoading = false;
        setMsgs((p) => ({
          ...p,
          [task.threadId]: [...p[task.threadId].slice(0, -1), lastElement],
        }));
        // Detect change to sending and creaet a slot for new msgs
      } else if (
        task.state.current === "sending" &&
        task.state.deltaState !== "sending"
      ) {
        //should be delta not deltaState
        // here we need to create a new slot for the next message
        // Note we need to add the input to for the user
        //console.log("Creating new entry for next chat", task)
        const newMsgArray = [
          { sender: "user", text: task.request.input, isLoading: false },
          { sender: "bot", text: "", isLoading: true },
        ];
        setMsgs((p) => ({
          ...p,
          [task.threadId]: [...p[task.threadId], ...newMsgArray],
        }));
      } else if (
        task.state.current === "input" &&
        task.state.deltaState !== "input" &&
        msgs[task.threadId]
      ) {
        // In the case where the response is coming from HTTP not websocket
        // The state will be set to input by the server
        const lastElement = {
          ...msgs[task.threadId][msgs[task.threadId].length - 1],
        }; // shallow copy
        lastElement.text = task.response.text;
        lastElement.isLoading = false;
        setMsgs((p) => ({
          ...p,
          [task.threadId]: [...p[task.threadId].slice(0, -1), lastElement],
        }));
        // TaskChat is dealing with input
      } else if (task.state.current === "input") {
        //console.log("Step input")
      }
    }
  }, [task]);

  useEffect(() => {
    if (task) {
      let welcomeMessage = task?.welcome_message || welcomeMessage_default;
      if (!isMountedRef.current) {
        setMsgs({
          [task.threadId]: [
            { sender: "bot", text: welcomeMessage, isLoading: true },
          ],
        });
        setTimeout(() => {
          setMsgs({
            [task.threadId]: [
              { sender: "bot", text: welcomeMessage, isLoading: false },
            ],
          });
        }, 1000);
        isMountedRef.current = true;
      } else if (!(task.threadId in msgs)) {
        // Why do we need this? Should use (p) => style
        setMsgs({
          ...msgs,
          [task.threadId]: [
            { sender: "bot", text: welcomeMessage, isLoading: false },
          ],
        });
      }
    }
  }, [msgs, task]);

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
    if (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 20
    ) {
      setHasScrolled(false);
    } else {
      setHasScrolled(true);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <section className="chatbox">
      <div id="chat-container" ref={chatContainer}>
        {task &&
          msgs[task.threadId] &&
          msgs[task.threadId].map((msg, index) => {
            return (
              <div
                key={index}
                className={`wrapper ${msg.sender === "bot" && "ai"}`}
              >
                <div className="chat">
                  <Icon sender={msg.sender} />
                  {msg.isLoading ? (
                    <div key={index} className="dot-typing"></div>
                  ) : (
                    <div className="message">{msg.text}</div>
                  )}
                </div>
              </div>
            );
          })}
        <div ref={messagesEndRef} style={{ height: "5px" }} />
      </div>
      {task && (
        <DynamicComponent
          key={task.id}
          is={task.stack[component_depth]}
          task={task}
          setTask={setTask}
          parentTask={conversationTask}
          component_depth={props.component_depth}
        />
      )}
    </section>
  );
};

export default React.memo(withTask(TaskConversation));
