/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useRef, useState, useEffect } from "react";
import withTask from "../../hoc/withTask";
import { utils } from "../../utils/utils.mjs";
import DynamicComponent from "./../Generic/DynamicComponent";
import Message from "./TaskConversation/Message";

/*
Task Function
  Present a conversation
  Launch a chat task that collects messages from human and bot
  Currently this TaskConversation does very little, in theory it could manage the conversation history
  The Task is passed on to the TaskChat component
  
ToDo:
  Another markdown rendering option https://github.com/HPouyanmehr/mui-markdown
  
*/

const TaskConversation = (props) => {
  const {
    task,
    modifyTask,
    childTask,
    modifyChildTask,
  } = props;

  const chatContainerRef = useRef();
  const messagesEndRef = useRef();
  const chatInputRef = useRef();
  const [chatInputHeight, setChatInputHeight] = useState();
  const [chatContainerTop, setChatContainerTop] = useState();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [chatResponse, setChatResponse] = useState();
  const chatSectionRef = useRef();

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  // There is a loop from the childTask.output.msgs to childTask.input.msgs
  // This potentiallly allows msgs to be controlled by TaskConversation e.g. user could edit previous messages
  useEffect(() => {
    //console.log("TaskConversation childTask?.output?.msgs", childTask?.output?.msgs);
    if (!utils.deepEqual(childTask?.output?.msgs, childTask?.input?.msgs)) {
      modifyChildTask({
        "input.msgs": childTask.output.msgs,
      });
    }
  }, [childTask?.output?.msgs]);

  function applyRegex(msgsToProcess) {
    if (msgsToProcess) {
      const regexProcessMessages = task.config?.local?.regexProcessMessages;
      if (regexProcessMessages) {
        for (const [regexStr, replacement] of regexProcessMessages) {
          let { pattern, flags } = utils.parseRegexString(regexStr);
          const regex = new RegExp(pattern, flags);
          if (msgsToProcess.length) {
            for (const msg of msgsToProcess) {
              if (msg.content) {
                msg.content = msg.content.replace(regex, replacement);
              }
            }
          } else {
            if (msgsToProcess.content) {
              msgsToProcess.content = msgsToProcess.content.replace(regex, replacement);
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
      if (childTask.output && childTask.output.LLMResponse !== chatResponse) {
        setChatResponse(applyRegex(childTask.output.LLMResponse));
      }
      let welcomeMessage = [];
      //console.log("newMsgArray", newMsgArray);
      // The welcome message is not included as part of the Task msgs sent to the LLM
      if (task.config?.local?.welcomeMessage && task.config.local.welcomeMessage !== "") {
        welcomeMessage.push({ role: "assistant", content: task.config.local.welcomeMessage, user: "assistant", id: "welcome" });
      }
      // deep copy because we may modify with regexProcessMessages
      let combinedMsgs = JSON.parse(JSON.stringify([...welcomeMessage, ...childMsgs]));
      // msgsHistory is what we will display
      if ((combinedMsgs.length && !task.output.msgsHistory) || (task.output.msgsHistory && combinedMsgs.length > task.output.msgsHistory.length)) {
        let msgsHistory;
        if (task.output.msgsHistory) {
          const numberOfExtraMsgs = combinedMsgs.length - task.output.msgsHistory.length;
          const extraMsgs = combinedMsgs.slice(-numberOfExtraMsgs); // Get the extra messages from the end
          msgsHistory = task.output.msgsHistory;
          msgsHistory = [...msgsHistory, ...extraMsgs];
          console.log("msgsHistory", msgsHistory, "extraMsgs", extraMsgs, "combinedMsgs", combinedMsgs, "numberOfExtraMsgs", numberOfExtraMsgs);
        } else {
          msgsHistory = combinedMsgs;
          console.log("msgsHistory", msgsHistory);
        }
        applyRegex(msgsHistory);
        modifyTask({"output.msgsHistory": msgsHistory});
      }
      // Convert to string to compare deep data structure
      if (JSON.stringify(combinedMsgs) !== JSON.stringify(msgs)) {
        applyRegex(combinedMsgs);
        setMsgs(combinedMsgs);
      }
    }
  }, [childTask?.output]);
 
  useEffect(() => {
    if (messagesEndRef.current && !hasScrolled) {
      //console.log("Scroll into view");
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    } 
  // For some reason I need to add childTask for this to work, unsure why
  }, [task.output.msgsHistory, hasScrolled, childTask]);

  const handleScroll = () => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer.clientHeight + chatContainer.scrollTop >= chatContainer.scrollHeight - 200) {
      setHasScrolled(false);
      //console.log("setHasScrolled false");
    } else {
      setHasScrolled(true);
      //console.log("setHasScrolled true");
    }
  };

  useEffect(() => {
    const chatContainerRect = chatContainerRef.current.getBoundingClientRect();
    const chatInputRect = chatInputRef.current.getBoundingClientRect();
    setChatInputHeight(chatInputRect.height);
    setChatContainerTop(chatContainerRect.top);
    //console.log("Updating chatContainerRect", chatContainerRect);
    //console.log("Updating chatInputRect", chatInputRect);
  // Added childTask so we update these values after chatInputRef has been rendered
  // This is a bit of a hack to avoid explicitly detecting the rendering of the chat component.
  // For exmaple it could use a callback.
  }, [childTask]);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    chatContainer.addEventListener("scroll", handleScroll);
    return () => {
      chatContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <section 
      className="chat-section"
      ref={chatSectionRef}
    >
      <div 
        id="chat-container" 
        ref={chatContainerRef}
        style={{
          // 24px related to top-padding, 10px related to bottom-padding 
          maxHeight: `calc(100vh - ${chatInputHeight}px - ${chatContainerTop}px - 24px - 10px)`,
        }}
      >
        { task.output.msgsHistory && task.output.msgsHistory.length > 0 &&
          task.output.msgsHistory.map((msg, index) => {
            //console.log("msg", msg);
            // Use components here so we can avoid re-rendering if nothing changes
            return (
              <Message 
                key={msg.id}
                role={msg.role}
                user={msg.user}
                content={msg.content}
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
            content={chatResponse.content}
            sending={childTask.output?.sending}
            id={chatResponse.id}
          />
        )}
        <div id="message-end" ref={messagesEndRef} style={{ height: "5px" }} />
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