/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useRef, useState, useEffect } from "react";
import withTask from "../../hoc/withTask";
import { deepCompare, replaceNewlinesWithParagraphs, parseRegexString } from "../../utils/utils";
import DynamicComponent from "./../Generic/DynamicComponent";
import Icon from "./TaskConversation/Icon";

/*
Task Process
  Present a conversation
  Launch a chat task that collects messages from human and bot
  Currently this TaskConversation does very little, in theory it could manage the conversation history
  The Task is passed on to the TaskChat component
  
ToDo:
  
*/

const TaskConversation = (props) => {
  const {
    task,
    modifyTask,
    childTask,
    modifyChildTask,
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
  const [chatResponse, setChatResponse] = useState();

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  // There is a loop from the childTask.output.msgs to task.state.msgs to childTask.input.msgs
  // This allows msgs to be controlled by TaskConversation
  useEffect(() => {
    if (task?.state?.msgs) {
      modifyChildTask({
        "input.msgs": task.state.msgs,
      });
    }
  }, [task?.state?.msgs]);

  function applyRegex(msgsToProcess) {
    if (msgsToProcess) {
      const regexProcessMessages = task.config.regexProcessMessages;
      if (regexProcessMessages) {
        for (const [regexStr, replacement] of regexProcessMessages) {
          let { pattern, flags } = parseRegexString(regexStr);
          const regex = new RegExp(pattern, flags);
          if (msgsToProcess.length) {
            for (const msg of msgsToProcess) {
              if (msg.text) {
                msg.text = msg.text.replace(regex, replacement);
              }
            }
          } else {
            if (msgsToProcess.text) {
              msgsToProcess.text = msgsToProcess.text.replace(regex, replacement);
            }
          }
        }
      }
    }
    return msgsToProcess;
  }

  useEffect(() => {
    if (childTask) {
      const childMsgs = childTask.output?.msgs || [];
      if (childTask.output.promptResponse !== chatResponse) {
        setChatResponse(applyRegex(childTask.output.promptResponse));
      }
      let welcomeMessage = [];
      //console.log("newMsgArray", newMsgArray);
      // The welcome message is not included as part of the Task msgs sent to the LLM
      if (task.config?.welcomeMessage && task.config.welcomeMessage !== "") {
        welcomeMessage.push({ role: "assistant", text: task.config.welcomeMessage, user: "assistant", id: "welcome" });
      }
      // deep copy because we may modify with regexProcessMessages
      let combinedMsgs = JSON.parse(JSON.stringify([...welcomeMessage, ...childMsgs]));
      // Convert to string to compare deep data structure
      if (JSON.stringify(combinedMsgs) !== JSON.stringify(msgs)) {
        applyRegex(combinedMsgs);
        setMsgs(combinedMsgs);
        modifyTask({ 
          "state.msgs": childMsgs,
        });
      }
    }
  }, [childTask?.output]);
 
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
    //console.log("Updating chatContainermaxHeight" + maxHeight);
  }, [chatContainerRef, chatInputRef]); // chatInputRef detects mobile screen rotation changes

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    chatContainer.addEventListener("scroll", handleScroll);
    return () => {
      chatContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // React.memo does not make any difference as TaskConversation is rerendering
  const Message = ({ role, user, text, sending, id }) => {
    if (!role || !user || !id) {
      console.error("Mesasge missing ", role, user, text, sending, id);
    }
    return (
      <div className={`wrapper ${role === "assistant" && "ai"}`}>
        <div className="chat">
          <Icon role={role} user={user} />
          {sending ? (
            <div className="dot-typing"></div>
          ) : (
            <div 
              className="message text2html"
              dangerouslySetInnerHTML={{ __html: replaceNewlinesWithParagraphs(text) }}
            />
          )}
        </div>
      </div>
    );
  };

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
            //console.log("msg", msg);
            // Use components here so we can avoid re-rendering if nothing changes
            return (
              <Message 
                key={msg.id}
                role={msg.role}
                user={msg.user}
                text={msg.text}
                sending={false}
                id={msg.id}
              />
            );
          })
        }
        { chatResponse && (
          <Message 
            key={chatResponse.id}
            role={chatResponse.role}
            user={chatResponse.user}
            text={chatResponse.text} 
            sending={childTask.output?.sending} 
            id={chatResponse.id}
          />
        )}
        <div ref={messagesEndRef} style={{ height: "5px" }} />
      </div>
      <div id="chat-input" ref={chatInputRef}>
        {childTask && (
          <DynamicComponent
            key={childTask.id}
            is={childTask.type}
            task={childTask}
            setTask={props.setChildTask}
            handleModifyChildTask={props.handleModifyChildTask}
            parentTask={task}
          />
        )}
      </div>
    </section>
  );
};

export default withTask(TaskConversation);
