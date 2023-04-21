// libs
import React, { useCallback, useState, useRef, useEffect } from 'react';
import PromptDropdown from './TaskChat/PromptDropdown';

// assets
import send from '../../assets/send.svg';

// contexts
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import useFetchTask from '../../hooks/useFetchTask';


const TaskChat = (props) => {

  const { task, msgs, setMsgs } = props
  
  const [fetchNow, setFetchNow] = useState();
  const { fetchResponse, fetched } = useFetchTask(fetchNow);
  const { webSocketEventEmitter } = useWebSocketContext();
  const [lastMessage, setLastMessage] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [messageHistory, setMessageHistory] = useState([]);
  const textareaRef = useRef(null);
  const [myTask, setMyTask] = useState(null);

  //console.log("TaskChat component")

  // This should be a prop ?
  useEffect(() => {
    if (task && task.id !== myTask?.id && task?.component === 'TaskChat') {
      setMyTask(task)
    }
  });

  useEffect(() => {
    if (!webSocketEventEmitter) {return}

    const handleMessage = (e) => {
      const j = JSON.parse(e.data)
      if (myTask?.instanceId && j?.instanceId === myTask.instanceId) {
        //setLastMessage(j);
        if (j?.delta || j?.text || j?.final) {
          let newMsgs =  JSON.parse(JSON.stringify(msgs)); // deep copy
          const lastElement = newMsgs[task.threadId][newMsgs[task.threadId].length - 1];
          if (j?.delta) {
            lastElement.text += j.delta
          }
          if (j?.text) {
            lastElement.text = j.text
          }
          if (j?.final) {
            lastElement.text = j.final
          }
          // This allows the text to be displayed
          lastElement.isLoading = false 
          newMsgs[task.threadId] = [...newMsgs[task.threadId].slice(0,-1), lastElement]
          setMsgs(newMsgs);
          setPending(false);
        }
        if (j?.message) {
          console.log("Message: " + j.message)
        }
      }
    };

    webSocketEventEmitter.on('message', handleMessage);

    return () => {
      webSocketEventEmitter.removeListener('message', handleMessage);
    };
  }, [webSocketEventEmitter, msgs, task]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault(); 
    if (!newMsg){
      return
    }
    setPending(true);
    const newMsgArray = [
      { sender: 'user', text: newMsg,  isLoading: false,}, 
      { sender: 'bot', 
        text: "", 
        isLoading: true, 
      }];
    let newMsgs =  JSON.parse(JSON.stringify(msgs)); // deep copy
    newMsgs[task.threadId] = [...newMsgs[task.threadId], ...newMsgArray]
    setMsgs(newMsgs);
    setMessageHistory((prev) => [...prev, newMsg]);
    // Update a copy to have immedaite effect so we can set fetchNow
    let myTaskCopy = { ...myTask };
    myTaskCopy['client_prompt'] = newMsg
    setFetchNow(myTaskCopy)
    // Clear the textbox for our next prompt
    setNewMsg("");
  },[msgs, setMsgs, newMsg, setNewMsg, task]);

  useEffect(() => {
   // Access the form element using the ref
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    textarea.placeholder="Écrivez votre prompt ici.";
  }, [newMsg]);

  const handleDropdownSelect = (selectedPrompt) => {
    setNewMsg(newMsg + selectedPrompt)
  };

  return (
    <form onSubmit={handleSubmit} className="msg-form">
        {myTask?.suggested_prompts ?
          <div style={{textAlign: 'left'}}>
            <PromptDropdown 
              prompts={myTask?.suggested_prompts} 
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
            value={newMsg}
            rows="1"
            cols="1"
            onChange={(e) => {
              setNewMsg(e.target.value);
            } }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey === false) {
                e.preventDefault();
                //console.log(formRef.current.elements.prompt.value);
                handleSubmit(e);
              }
            } }
          />
          <button type="submit" disabled={pending} className={pending ? "send-button not-ready" : "send-button ready"}>
            {/* The key stops React double loading the image when both img and message are updated */}
            <img key={send} src={send} alt="Send" className={pending ? "send-not-ready" : "send-ready"} />
          </button>
        </div>
        {/* <div>The WebSocket is currently {connectionStatus}</div> */}
        {lastMessage ? <span>Last message: {lastMessage.data}</span> : null}
        <ul>
          {messageHistory?.map((message, idx) => (
            <span key={idx}>{message ? message.data : null}</span>
          ))}
        </ul>
    </form>
  );
}

export default React.memo(TaskChat);